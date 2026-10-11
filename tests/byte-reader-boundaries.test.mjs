import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync, rmSync, realpathSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('..', import.meta.url)), parent = path.join(repository, 'work');
const checked = (result, status, reason) => {
  assert.ifError(result.error); assert.equal(result.signal, null);
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (reason) assert.ok(result.stderr.replaceAll('\\', '/').includes(reason), result.stderr);
  else assert.match(result.stdout, /Boundary check PASS/);
};
// Adapted from the first-party canvas-text-provider-boundaries actual-copy
// scaffold (through text-field/textured-webgpu/project controls). The baseline
// is a genuine compiled graph; mutations prove policy, not byte-reader behavior.
function isolated(action) {
  mkdirSync(parent, {recursive:true});
  const fixture = mkdtempSync(path.join(parent, 'byte-reader-boundary-'));
  const checker = readFileSync(path.join(repository, 'tools/check-boundaries.mjs'));
  const checkerHash = createHash('sha256').update(checker).digest('hex');
  const write = (relative, content) => {
    const file = path.join(fixture, relative);
    mkdirSync(path.dirname(file), {recursive:true}); writeFileSync(file, content);
  };
  const edit = (relative, change) => {
    const before = readFileSync(path.join(fixture, relative), 'utf8'), after = change(before);
    assert.notEqual(after, before, 'A control must change the real copied file: ' + relative);
    write(relative, after);
  };
  try {
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      for (const entry of ['package.json', 'tsconfig.json', 'src', 'dist', ...(name === 'engine' ? ['web', 'rendering', 'tsconfig.web.json', 'tsconfig.rendering.json'] : [])])
        cpSync(path.join(repository, 'packages', name, entry), path.join(fixture, 'packages', name, entry), {recursive:true});
      mkdirSync(path.join(fixture, 'node_modules/@egret'), {recursive:true});
      const packageRoot = path.join(fixture, 'packages', name), link = path.join(fixture, 'node_modules/@egret', name);
      symlinkSync(packageRoot, link, 'junction'); assert.equal(realpathSync(link), realpathSync(packageRoot));
    }
    for (const name of ['jsonc-parser', 'robust-predicates']) {
      const require = createRequire(path.join(repository, 'packages', name === 'jsonc-parser' ? 'project' : 'engine', 'package.json'));
      const entry = realpathSync(require.resolve(name));
      const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
      cpSync(installed, path.join(fixture, 'node_modules', name), {recursive:true});
    }
    write('tools/check-boundaries.mjs', checker);
    assert.equal(createHash('sha256').update(readFileSync(path.join(fixture, 'tools/check-boundaries.mjs'))).digest('hex'), checkerHash);
    const check = () => spawnSync(process.execPath, ['tools/check-boundaries.mjs'], {cwd:fixture, encoding:'utf8', maxBuffer:8 * 1024 * 1024});
    return action({edit, check, checkerHash});
  } finally {
    const resolved = realpathSync(fixture);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase() + path.sep) && path.basename(resolved).startsWith('byte-reader-boundary-'));
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      const link = path.join(resolved, 'node_modules/@egret', name);
      if (existsSync(link)) assert.equal(realpathSync(link), realpathSync(path.join(resolved, 'packages', name)), 'Junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved, {recursive:true, force:true}); assert.equal(existsSync(resolved), false);
  }
}
const replaceOne = (raw, expression, replacement) => {
  assert.equal([...raw.matchAll(new RegExp(expression.source, expression.flags.includes('g') ? expression.flags : expression.flags + 'g'))].length, 1, 'Mutation needs one genuine existing clause');
  return raw.replace(expression, replacement);
};
const rootValueClause = /export\s*\{\s*ByteReader\s*,\s*BYTE_READER_LIMITS\s*\}\s*from\s*["']@egret\/runtime["'];?/;
const rootTypeClause = /export\s+type\s*\{\s*ByteOrder\s*\}\s*from\s*["']@egret\/runtime["'];?/;
const runtimeValueClause = /export\s*\{\s*ByteReader\s*,\s*BYTE_READER_LIMITS\s*\}\s*from\s*["']\.\/ByteReader\.js["'];?/;

test('BR1 genuine compiled four-package baseline passes the complete production checker', t => isolated(f => {
  checked(f.check(), 0); t.diagnostic('Genuine copied graph; checker ' + f.checkerHash + '; no replacement product implementation.');
}));
const controls = [
  ['split root constructor', 'packages/engine/dist/index.js', raw => replaceOne(raw, rootValueClause, "export {BYTE_READER_LIMITS} from '@egret/runtime';\nexport class ByteReader {}"), 'root: ByteReader runtime identity mismatch: ByteReader'],
  ['split root limits object', 'packages/engine/dist/index.js', raw => replaceOne(raw, rootValueClause, "export {ByteReader} from '@egret/runtime';\nexport const BYTE_READER_LIMITS = Object.freeze({maxBytes:16777216});"), 'root: ByteReader runtime identity mismatch: BYTE_READER_LIMITS'],
  ['missing root value retains old inventory refusal', 'packages/engine/dist/index.js', raw => replaceOne(raw, rootValueClause, "export {BYTE_READER_LIMITS} from '@egret/runtime';"), 'root: executable textured-frame export surface mismatch'],
  ['erased constructor declaration cannot replace value port', 'packages/engine/dist/index.d.ts', raw => replaceOne(raw, rootValueClause, "export type {ByteReader,BYTE_READER_LIMITS} from '@egret/runtime';"), 'root: exact ByteReader declaration re-export mismatch'],
  ['duplicate root ByteOrder declaration', 'packages/engine/dist/index.d.ts', raw => raw + "\nexport type {ByteOrder} from '@egret/runtime';\n", 'root: exact ByteReader declaration re-export mismatch'],
  ['wrong ByteOrder declaration target', 'packages/engine/dist/index.d.ts', raw => replaceOne(raw, rootTypeClause, "export type {ByteOrder} from '@egret/contracts';"), 'root: exact ByteReader declaration re-export mismatch'],
  ['aliased runtime value declaration', 'packages/runtime/dist/index.d.ts', raw => replaceOne(raw, runtimeValueClause, "export {ByteReader as LegacyByteReader,BYTE_READER_LIMITS} from './ByteReader.js';"), 'runtime: exact ByteReader declaration re-export mismatch'],
  ['extra runtime type namespace', 'packages/runtime/dist/index.d.ts', raw => raw + "\nexport type * as ExtraBinary from './ByteReader.js';\n", 'runtime: exact ByteReader declaration re-export mismatch'],
  ['extra root runtime-wide type namespace', 'packages/engine/dist/index.d.ts', raw => raw + "\nexport type * as ExtraBinary from '@egret/runtime';\n", 'root: exact ByteReader declaration re-export mismatch'],
  ['extra canonical erased alias', 'packages/runtime/dist/ByteReader.d.ts', raw => raw + '\nexport type {ByteOrder as SecondaryOrder};\n', 'runtime: canonical ByteReader declaration export surface mismatch'],
  ['canonical ByteOrder runtime value', 'packages/runtime/dist/ByteReader.js', raw => raw + '\nexport const ByteOrder = 1;\n', 'runtime: canonical ByteReader runtime export surface mismatch'],
  ['Node ambient declaration', 'packages/runtime/dist/ByteReader.d.ts', raw => raw + '\ntype ByteReaderNodeProbe = NodeJS.Impossible;\n', 'packages/runtime/dist/ByteReader.d.ts: host ambient dependency'],
  ['DOM triple-slash source dependency', 'packages/runtime/src/ByteReader.ts', raw => raw + '\n/// <reference lib="dom" />\n', 'packages/runtime/src/ByteReader.ts: host ambient dependency'],
  ['aliased runtime-wide namespace on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nexport type * as ExtraBinary from '@egret/runtime';\n", 'web: root/runtime-only ByteReader module leaked'],
  ['new runtime subpath retains old map refusal', 'packages/runtime/package.json', raw => {
    const pkg = JSON.parse(raw); pkg.exports['./binary'] = {types:'./dist/ByteReader.d.ts', import:'./dist/ByteReader.js'};
    return JSON.stringify(pkg);
  }, 'runtime: text explicit export mapping mismatch'],
  ['new runtime dependency retains old DAG refusal', 'packages/runtime/package.json', raw => {
    const pkg = JSON.parse(raw); pkg.dependencies['jsonc-parser'] = '3.3.1'; return JSON.stringify(pkg);
  }, 'runtime: dependency DAG mismatch'],
  // R2 closes local namespace forwarding on the genuine declaration. Every
  // mutation below still passes the full copied baseline before its own edit.
  ['indirect type namespace on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as ExtraBinary from '@egret/runtime';\nexport type { ExtraBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['ordinary namespace with renamed type export on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport * as LocalBinary from '@egret/runtime';\nexport type { LocalBinary as RenamedBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['multiple namespace bindings with only the second forwarded', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as UnusedBinary from '@egret/runtime';\nimport * as SelectedBinary from '@egret/runtime';\ninterface LocalMarker {}\nexport type { LocalMarker, SelectedBinary as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['repeated namespace local name cannot hide forwarding', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as RepeatedBinary from '@egret/runtime';\nimport type * as RepeatedBinary from '@egret/runtime';\nexport type { RepeatedBinary as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['inline type namespace export on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport * as InlineBinary from '@egret/runtime';\nexport { type InlineBinary as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['literal Unicode and dollar namespace local names', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as 二进制$ from '@egret/runtime';\nexport type { 二进制$ as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['exported typeof namespace alias on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as QueriedBinary from '@egret/runtime';\nexport type PublicBinary = typeof QueriedBinary;\n", 'web: root/runtime-only ByteReader module leaked'],
  ['local typeof relay then renamed export on web', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport * as RelayBinary from '@egret/runtime';\ntype LocalRelay = typeof RelayBinary;\nexport type { LocalRelay as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['root namespace import cannot add an erased public namespace', 'packages/engine/dist/index.d.ts', raw => raw + "\nimport type * as ExtraBinary from '@egret/runtime';\nexport type { ExtraBinary as PublicBinary };\n", 'root: exact ByteReader declaration re-export mismatch'],
  ['escaped namespace local binding remains forbidden', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as Extra\\u0042inary from '@egret/runtime';\nexport type { ExtraBinary as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['escaped namespace export use remains forbidden', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nimport * as ExtraBinary from '@egret/runtime';\nexport type { Extra\\u0042inary as PublicBinary };\n", 'web: root/runtime-only ByteReader module leaked'],
  ['typeof default-runtime import query remains forbidden', 'packages/engine/dist/web/index.d.ts', raw => raw + "\nexport type ExtraBinary = typeof import('@egret/runtime');\n", 'web: root/runtime-only ByteReader module leaked'],
];
for (const [name, file, change, reason] of controls) test('BR1 actual baseline then ' + name, () => isolated(f => {
  checked(f.check(), 0); f.edit(file, change); checked(f.check(), 1, reason);
}));
test('BR1 unused default-runtime namespace is also outside the admitted barrel grammar', () => isolated(f => {
  checked(f.check(), 0);
  f.edit('packages/engine/dist/web/index.d.ts', raw => raw + "\nimport type * as ExtraBinary from '@egret/runtime';\n// ExtraBinary is comment text only.\n/* ExtraBinary remains comment text. */\ntype NamespaceSpelling = 'ExtraBinary';\ntype NamespaceQuoted = \"ExtraBinary\";\ntype NamespaceEscaped = \"prefix \\\" ExtraBinary\";\ntype NamespaceSlash = \"// ExtraBinary\";\ntype NamespaceTemplate = `ExtraBinary`;\n");
  checked(f.check(), 1, 'web: root/runtime-only ByteReader module leaked');
}));
test('BR1 namespace import and query text in comments and literals does not grant a module port', () => isolated(f => {
  checked(f.check(), 0);
  f.edit('packages/engine/dist/web/index.d.ts', raw => raw + "\n// import type * as ExtraBinary from '@egret/runtime';\n/* export type ExtraBinary = typeof import('@egret/runtime'); */\ntype NamespaceText = \"import type * as ExtraBinary from '@egret/runtime';\";\ntype QueryText = 'typeof import(\"@egret/runtime\")';\ntype EscapedText = \"prefix \\\" import * as ExtraBinary from '@egret/runtime';\";\ntype TemplateText = `import * as ExtraBinary from '@egret/runtime';`;\n");
  checked(f.check(), 0);
}));

// Each explicit entry gets one declaration witness. Existing exact-entry
// refusals retain priority; the less restrictive web/contracts barrels use BR1.
const forbiddenEntries = [
  ['contracts', 'packages/contracts/dist/index.d.ts', 'contracts: root/runtime-only ByteReader port leaked: ByteOrder'],
  ['web', 'packages/engine/dist/web/index.d.ts', 'web: root/runtime-only ByteReader port leaked: ByteOrder'],
  ['webgpu', 'packages/engine/dist/web/webgpu.d.ts', 'webgpu: exact type-only host export surface mismatch'],
  ['runtime/text', 'packages/runtime/dist/text/index.d.ts', 'runtime/text: exact text declaration surface mismatch'],
  ['engine/text', 'packages/engine/dist/text.d.ts', 'engine/text: exact text declaration surface mismatch'],
  ['project', 'packages/project/dist/index.d.ts', 'project: type-only export surface mismatch'],
];
for (const [entry, file, reason] of forbiddenEntries) test('BR1 ' + entry + ' declaration remains outside the binary root surface', () => isolated(f => {
  checked(f.check(), 0); f.edit(file, raw => raw + '\nexport type ByteOrder = "bigEndian";\n'); checked(f.check(), 1, reason);
}));
test('BR1 new declaration fault does not displace the retained private Mesh refusal', () => isolated(f => {
  checked(f.check(), 0);
  f.edit('packages/engine/dist/index.d.ts', raw => raw + "\nexport type {ByteOrder} from '@egret/runtime';\nexport interface MeshCaptureState {}\n");
  checked(f.check(), 1, 'root: private Mesh authority leaked: MeshCaptureState');
}));
