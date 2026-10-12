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
// is a genuine compiled graph; mutations prove policy, not byte-writer behavior.
function isolated(action) {
  mkdirSync(parent, {recursive:true});
  const fixture = mkdtempSync(path.join(parent, 'byte-writer-boundary-'));
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
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase() + path.sep) && path.basename(resolved).startsWith('byte-writer-boundary-'));
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
const rootValueClause = /export\s*\{\s*ByteWriter\s*,\s*BYTE_WRITER_LIMITS\s*\}\s*from\s*["']@egret\/runtime["'];?/;
const runtimeValueClause = /export\s*\{\s*ByteWriter\s*,\s*BYTE_WRITER_LIMITS\s*\}\s*from\s*["']\.\/ByteWriter\.js["'];?/;
const writerOrderImport = /import\s+type\s*\{\s*ByteOrder\s*\}\s*from\s*["']\.\/ByteReader\.js["'];?/;

test('BW1 genuine compiled four-package baseline passes the complete production checker', t => isolated(f => {
  checked(f.check(), 0);
  t.diagnostic('Genuine copied graph; checker ' + f.checkerHash + '; no replacement product implementation.');
}));
// Every control starts with a fresh complete copied baseline. A missing emitted
// runtime name would break the engine named ESM import at setup; its source
// forward is tested instead, while executable split values test identity.
const controls = [
  ['missing root constructor retains original inventory refusal', 'packages/engine/dist/index.js',
    raw => replaceOne(raw, rootValueClause, "export {BYTE_WRITER_LIMITS} from '@egret/runtime';"),
    'root: executable textured-frame export surface mismatch'],
  ['missing root limits retains original inventory refusal', 'packages/engine/dist/index.js',
    raw => replaceOne(raw, rootValueClause, "export {ByteWriter} from '@egret/runtime';"),
    'root: executable textured-frame export surface mismatch'],
  ['missing runtime source value forward', 'packages/runtime/src/index.ts',
    raw => replaceOne(raw, runtimeValueClause, "export {BYTE_WRITER_LIMITS} from './ByteWriter.js';"),
    'runtime: exact ByteWriter value re-export mismatch: packages/runtime/src/index.ts'],
  ['split runtime constructor', 'packages/runtime/dist/index.js',
    raw => replaceOne(raw, runtimeValueClause, "export {BYTE_WRITER_LIMITS} from './ByteWriter.js';\nexport class ByteWriter {}"),
    'runtime: ByteWriter module identity mismatch: ByteWriter'],
  ['split runtime limits object', 'packages/runtime/dist/index.js',
    raw => replaceOne(raw, runtimeValueClause, "export {ByteWriter} from './ByteWriter.js';\nexport const BYTE_WRITER_LIMITS = Object.freeze({maxBytes:16777216});"),
    'runtime: ByteWriter module identity mismatch: BYTE_WRITER_LIMITS'],
  ['split root constructor', 'packages/engine/dist/index.js',
    raw => replaceOne(raw, rootValueClause, "export {BYTE_WRITER_LIMITS} from '@egret/runtime';\nexport class ByteWriter {}"),
    'root: ByteWriter runtime identity mismatch: ByteWriter'],
  ['split root limits object', 'packages/engine/dist/index.js',
    raw => replaceOne(raw, rootValueClause, "export {ByteWriter} from '@egret/runtime';\nexport const BYTE_WRITER_LIMITS = Object.freeze({maxBytes:16777216});"),
    'root: ByteWriter runtime identity mismatch: BYTE_WRITER_LIMITS'],
  ['erased root declaration cannot replace the value forward', 'packages/engine/dist/index.d.ts',
    raw => replaceOne(raw, rootValueClause, "export type {ByteWriter,BYTE_WRITER_LIMITS} from '@egret/runtime';"),
    'root: exact ByteWriter value re-export mismatch: packages/engine/dist/index.d.ts'],
  ['aliased runtime declaration is not the canonical pair', 'packages/runtime/dist/index.d.ts',
    raw => replaceOne(raw, runtimeValueClause, "export {ByteWriter as RenamedWriter,BYTE_WRITER_LIMITS} from './ByteWriter.js';"),
    'runtime: exact ByteWriter value re-export mismatch: packages/runtime/dist/index.d.ts'],
  ['canonical order import cannot target another module', 'packages/runtime/dist/ByteWriter.d.ts',
    raw => replaceOne(raw, writerOrderImport, "import type {ByteOrder} from './Scope.js';"),
    'runtime: canonical ByteWriter original ByteOrder type import mismatch: packages/runtime/dist/ByteWriter.d.ts'],
  ['canonical writer cannot duplicate the public order declaration', 'packages/runtime/dist/ByteWriter.d.ts',
    raw => raw + '\nexport type ByteOrder = "bigEndian" | "littleEndian";\n',
    'runtime: canonical ByteWriter declaration/source export surface mismatch: packages/runtime/dist/ByteWriter.d.ts'],
  ['named writer type cannot leak through Canvas entry', 'packages/engine/dist/web/index.d.ts',
    raw => raw + "\nexport type {ByteWriter} from '@egret/runtime';\n",
    'web: root/runtime-only ByteWriter port leaked: ByteWriter'],
  ['limits declaration cannot leak through contracts', 'packages/contracts/dist/index.d.ts',
    raw => raw + '\nexport declare const BYTE_WRITER_LIMITS: Readonly<{maxBytes:16777216}>;\n',
    'contracts: root/runtime-only ByteWriter port leaked: BYTE_WRITER_LIMITS'],
  ['DOM ambient declaration', 'packages/runtime/dist/ByteWriter.d.ts',
    raw => raw + '\ntype ByteWriterDOMProbe = Document;\n',
    'packages/runtime/dist/ByteWriter.d.ts: host ambient dependency'],
  ['DOM triple-slash source dependency', 'packages/runtime/src/ByteWriter.ts',
    raw => raw + '\n/// <reference lib="dom" />\n',
    'packages/runtime/src/ByteWriter.ts: host ambient dependency'],
];
for (const [name, file, change, reason] of controls) test('BW1 actual baseline then ' + name, () => isolated(f => {
  checked(f.check(), 0); f.edit(file, change); checked(f.check(), 1, reason);
}));
test('BW1 new declaration fault leaves the retained BR1 refusal authoritative', () => isolated(f => {
  checked(f.check(), 0);
  f.edit('packages/engine/dist/index.d.ts', raw => raw
    + "\nexport type {ByteOrder} from '@egret/runtime';\nexport type {ByteWriter} from '@egret/runtime';\n");
  checked(f.check(), 1, 'root: exact ByteReader declaration re-export mismatch');
}));
