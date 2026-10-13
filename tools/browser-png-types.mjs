// SPDX-License-Identifier: Apache-2.0
// Replay complete observed strict diagnostics; runtime and browser acceptance stay separate.
import { readFileSync, realpathSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath } from './lib/file-identity.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const inventoryPath = 'tests/types/browser-png-diagnostic-expectations.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const failure = message => { throw new Error('Browser PNG types: ' + message); };
if (process.argv.length !== 2) failure('this gate accepts no arguments');
const inventoryBytes = readFileSync(path.join(root, inventoryPath));
const inventory = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inventoryBytes));
const inventoryPin = fingerprintFile(root, inventoryPath);
const selfPin = fingerprintFile(root, 'tools/browser-png-types.mjs');
const lanes = ['positive', 'negative', 'import-negative', 'dom-free-positive', 'dom-free-negative'];
if (inventory.schemaVersion !== 1 || inventory.kind !== 'BROWSER_PNG_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'
  || !equal(inventory.tupleFormat, ['file', 'line', 'column', 'code', 'message'])
  || inventory.compiler?.name !== 'typescript' || inventory.compiler.version !== '7.0.2'
  || inventory.compiler.entry !== 'node_modules/typescript/bin/tsc'
  || !equal(inventory.lanes?.map(row => row.lane), lanes)) failure('wrong observed inventory or compiler');

function checkPin(pin) {
  logicalPath(pin.path);
  if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[0-9a-f]{64}$/.test(pin.sha256)) failure('malformed raw pin');
  const actual = fingerprintFile(root, pin.path);
  if (actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256) failure('changed input: ' + pin.path);
}
// Installed package links are authenticated separately from repository file reads.
const dependencyOwner = realpathSync(path.join(root, 'node_modules'));
function installed(owner) {
  ownerRelativePath(dependencyOwner, path.join(owner, 'package.json'));
  if (!samePhysicalPath(realpathSync(owner), owner)) failure('another installed owner');
}
const compilerOwner = path.dirname(realpathSync(path.join(root, 'node_modules/typescript/package.json')));
installed(compilerOwner);
const metadata = JSON.parse(readFileSync(path.join(compilerOwner, 'package.json'), 'utf8'));
if (metadata.name !== 'typescript' || metadata.version !== '7.0.2'
  || !equal(metadata.bin, { tsc: './bin/tsc' }) || metadata.imports?.['#getExePath'] !== './lib/getExePath.js') failure('wrong compiler launcher');
for (const relative of ['bin/tsc', 'lib/tsc.js', 'lib/getExePath.js']) {
  if (!samePhysicalPath(realpathSync(path.join(root, 'node_modules/typescript', relative)), path.join(compilerOwner, relative))) failure('compiler link owner changed');
}
const requireFromCompiler = createRequire(path.join(compilerOwner, 'package.json'));
const nativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
const nativeMetadataPath = requireFromCompiler.resolve(nativeName + '/package.json');
const nativeOwner = path.dirname(realpathSync(nativeMetadataPath));
installed(nativeOwner);
const nativeMetadata = JSON.parse(readFileSync(nativeMetadataPath, 'utf8'));
if (nativeMetadata.name !== nativeName || nativeMetadata.version !== '7.0.2'
  || metadata.optionalDependencies?.[nativeName] !== '7.0.2'
  || !equal(nativeMetadata.os, [process.platform]) || !equal(nativeMetadata.cpu, [process.arch])) failure('wrong platform-native compiler package');
const nativeRelative = process.platform === 'win32' ? 'lib/tsc.exe' : 'lib/tsc';
const nativeBinary = path.join(nativeOwner, nativeRelative);
function installedPin(owner, relative) {
  const filename = path.join(owner, relative), stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || !samePhysicalPath(realpathSync(filename), filename)) failure('installed file escaped qualified package');
  const bytes = readFileSync(filename);
  return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
}
function witness() {
  const declarations = readdirSync(path.join(compilerOwner, 'lib')).filter(name => name.endsWith('.d.ts')).sort();
  if (declarations.length === 0) failure('missing stock declaration library');
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    if (!samePhysicalPath(realpathSync(path.join(root, 'node_modules/@egret', name)), path.join(root, 'packages', name))) failure('workspace package alias points to another owner');
  }
  return { compilerOwner, nativeOwner, nativeResolution: realpathSync(nativeMetadataPath),
    launcher: ['package.json', 'bin/tsc', 'lib/tsc.js', 'lib/getExePath.js'].map(file => installedPin(compilerOwner, file)),
    native: ['package.json', nativeRelative].map(file => installedPin(nativeOwner, file)),
    declarations: declarations.map(name => installedPin(compilerOwner, 'lib/' + name)) };
}
const currentOwners = witness();
const compilerPaths = ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc',
  'node_modules/typescript/lib/tsc.js', 'node_modules/typescript/lib/getExePath.js', 'pnpm-lock.yaml'];
if (!equal(inventory.compiler.pins?.map(row => row.path), compilerPaths)) failure('missing stock launcher/lock identities');
const productPaths = ['packages/engine/package.json', 'packages/engine/web/image.ts',
  'packages/engine/web/BrowserTextureProvider.ts', 'packages/engine/dist/web/image.js',
  'packages/engine/dist/web/image.d.ts', 'packages/engine/dist/web/BrowserTextureProvider.js',
  'packages/engine/dist/web/BrowserTextureProvider.d.ts'];
const configurationPaths = ['tsconfig.base.json', 'tsconfig.json', 'packages/contracts/tsconfig.json',
  'packages/runtime/tsconfig.json', 'packages/engine/tsconfig.json', 'packages/engine/tsconfig.rendering.json',
  'packages/engine/tsconfig.web.json', 'packages/project/tsconfig.json'];
if (!equal(inventory.productPins?.map(row => row.path), productPaths)
  || !equal(inventory.configurationPins?.map(row => row.path), configurationPaths)) failure('incomplete product or project configuration inventory');
function checkCompilerPin(pin) {
  if (pin.path === 'pnpm-lock.yaml') return checkPin(pin);
  const relative = pin.path.slice('node_modules/typescript/'.length);
  const actual = installedPin(compilerOwner, relative);
  if (actual.bytes !== pin.bytes || actual.sha256 !== pin.sha256) failure('changed stock compiler input: ' + pin.path);
}
const names = new Set();
function markers(group) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path.join(root, group.sourcePin.path)));
  if (/@ts-(?:ignore|expect-error|nocheck)\b/.test(text)) failure('suppressed consumer diagnostic');
  const sourceLines = text.split('\n'), found = [];
  const prefix = group.lane === 'negative' ? 'N' : group.lane === 'import-negative' ? 'I'
    : group.lane === 'dom-free-negative' ? 'DN' : group.lane === 'positive' ? 'P' : 'DP';
  for (let at = 0; at < sourceLines.length; at++) {
    if (!sourceLines[at].includes('BIP_TYPE_CASE')) continue;
    const match = /^\/\/ BIP_TYPE_CASE (BIP1-(?:P|DP|N|I|DN)\d{2}): (.+)$/.exec(sourceLines[at]);
    if (!match || !match[1].startsWith('BIP1-' + prefix) || names.has(match[1])
      || !sourceLines[at + 1]?.trim() || /^\s*\/\//.test(sourceLines[at + 1])) failure('malformed or duplicate case marker');
    names.add(match[1]);
    found.push({ name: match[1], line: at + 2, statement: sourceLines[at + 1], intent: match[2] });
  }
  const negative = group.expectedExit === 1;
  if (negative && (!equal(found, group.markers) || found.length === 0)) failure('changed negative statements or intentions');
  if (!negative && group.markers.length !== 0) failure('positive lane has negative marker table');
}
for (const group of inventory.lanes) {
  const negative = group.lane.includes('negative');
  if (group.expectedExit !== (negative ? 1 : 0)
    || group.sourcePin.path !== 'tests/types/browser-png-' + group.lane + '.ts'
    || group.configPin.path !== 'tests/types/tsconfig.browser-png-' + group.lane + '.json') failure('wrong lane identity');
  checkPin(group.sourcePin); checkPin(group.configPin); markers(group);
  if (!Array.isArray(group.diagnostics) || (negative ? group.diagnostics.length === 0 : group.diagnostics.length !== 0)) failure('wrong observed lane diagnostics');
}
function unchanged() {
  checkPin(inventoryPin); checkPin(selfPin);
  for (const pin of inventory.productPins) checkPin(pin);
  for (const pin of inventory.configurationPins) checkPin(pin);
  for (const group of inventory.lanes) { checkPin(group.sourcePin); checkPin(group.configPin); }
  for (const pin of inventory.compiler.pins) checkCompilerPin(pin);
  if (!equal(witness(), currentOwners)) failure('installed compiler owner or raw bytes changed');
}
function diagnosticMessage(text) {
  return text.replace(/(["'])((?:[A-Za-z]:[\\/]|\\\\|\/)[^"']+)\1/g, (all, quote, filename) => {
    let relative;
    try { relative = ownerRelativePath(root, filename); }
    catch { failure('unowned absolute filename in diagnostic message'); }
    return quote + '<repo>/' + relative + quote;
  });
}
function parseDiagnostics(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
  if (!text) return [];
  if (text.includes('\r') || !text.endsWith('\n')) failure('incomplete compiler output');
  const result = [];
  for (const line of text.slice(0, -1).split('\n')) {
    const match = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (match) {
      const code = Number(match[4]);
      if ([2307, 2688, 6053, 5058, 5083, 5110].includes(code)) failure('compiler setup diagnostic is not a refusal witness');
      const filename = path.isAbsolute(match[1]) || /^[A-Za-z]:[\\/]/.test(match[1])
        ? ownerRelativePath(root, match[1]) : logicalPath(match[1].replaceAll('\\', '/'));
      result.push({ file: filename, line: Number(match[2]), column: Number(match[3]), code, message: diagnosticMessage(match[5]) });
    } else {
      if (!result.length || !/^ {2,}\S.*$/.test(line)) failure('unconsumed compiler output');
      result.at(-1).message += '\n' + diagnosticMessage(line);
    }
  }
  return result;
}
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete environment[key];
}
// No diagnostic count can substitute for these complete observed tuples.
for (const group of inventory.lanes) {
  unchanged();
  const result = spawnSync(process.execPath, [inventory.compiler.entry, '--project', group.configPin.path, '--pretty', 'false'],
    { cwd: root, env: environment, windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? Buffer.alloc(0));
  process.stderr.write(result.stderr ?? Buffer.alloc(0));
  unchanged();
  if (result.error || result.signal !== null || result.status !== group.expectedExit || result.stderr?.length) {
    throw result.error ?? new Error('Browser PNG types: compiler settlement refused in ' + group.lane);
  }
  const observed = parseDiagnostics(result.stdout ?? Buffer.alloc(0));
  if (!equal(observed, group.diagnostics) || observed.some(row => row.file !== group.sourcePin.path)
    || new Set(observed.map(row => JSON.stringify(row))).size !== observed.length) failure('changed/missing/extra/duplicate complete diagnostics in ' + group.lane);
  console.log('Browser PNG ' + group.lane + ' exact diagnostic replay: ' + JSON.stringify(observed));
}
unchanged();
console.log('Browser PNG current native compiler witness: ' + JSON.stringify({ name: nativeName,
  version: nativeMetadata.version, platform: process.platform, arch: process.arch, pins: currentOwners.native }));
console.log('Browser PNG strict consumers PASS; runtime, policy and native acceptance are separate.');
