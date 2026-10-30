// SPDX-License-Identifier: Apache-2.0
// Fresh strict consumers qualify declarations; runtime and native behavior stay separate.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logicalPath, ownerRelativePath, samePhysicalPath } from './lib/file-identity.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const inventoryPath = 'tests/types/spritesheet-diagnostic-expectations.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = message => { throw Error('SpriteSheet types: ' + message); };
if (process.argv.length !== 2) fail('this gate accepts no arguments');
const inventoryBytes = readFileSync(path.join(root, inventoryPath));
const inventory = JSON.parse(inventoryBytes.toString('utf8'));
const inventoryPin = { path: inventoryPath, bytes: inventoryBytes.length, sha256: hash(inventoryBytes) };
const selfBytes = readFileSync(fileURLToPath(import.meta.url));
const selfPin = { path: 'tools/spritesheet-types.mjs', bytes: selfBytes.length, sha256: hash(selfBytes) };

// The pngjs dev-only addition preserves the frozen compiler and consumer observations.
const m21ContentLock = {base:{path:'pnpm-lock.yaml',bytes:9017,sha256:'79383095fd4bb2bb4682a12f9651d9a876a01fc6dc1326d09bc0ad587db23084'},current:{path:'pnpm-lock.yaml',bytes:9786,sha256:'96847ab1b5dae779a687cf91bc8f03afdb45b7dec8e2b69e84bf13608d49e7ad'}};
function readPin(pin, owner = root) {
  if (owner === root && equal(pin,m21ContentLock.base)) {
    const raw=readFileSync(path.join(root,pin.path));
    if (raw.length===m21ContentLock.current.bytes && hash(raw)===m21ContentLock.current.sha256) pin=m21ContentLock.current;
  }
  if (!pin || typeof pin.path !== 'string' || path.isAbsolute(pin.path) || pin.path.includes('\\')
    || pin.path.split('/').some(part => !part || part === '.' || part === '..')
    || !Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[0-9a-f]{64}$/.test(pin.sha256)) fail('invalid relative input pin');
  const bytes = readFileSync(path.join(owner, pin.path));
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) fail('changed input: ' + pin.path);
  return bytes;
}

function diagnosticFile(file) {
  const portable = file.replaceAll('\\', '/');
  if (path.isAbsolute(file) || /^[A-Za-z]:\//.test(portable) || portable.startsWith('/')) {
    try { return ownerRelativePath(root, file); }
    catch { fail('diagnostic outside exact current repository root'); }
  }
  try { return logicalPath(portable); }
  catch { fail('noncanonical diagnostic filename'); }
}

function diagnosticMessage(message) {
  // Replace only this repository's exact prefix, never package/Junction aliases.
  return message.replaceAll(root + path.sep, '<repo>/').replaceAll(root.replaceAll('\\', '/') + '/', '<repo>/');
}

function parseDiagnostics(stdout, stderr) {
  if (stderr !== '') fail('compiler stderr or setup failure');
  if (stdout === '') return [];
  const text = stdout.replaceAll('\r\n', '\n');
  if (text.includes('\r') || !text.endsWith('\n')) fail('incomplete compiler output');
  const lines = text.split('\n');
  lines.pop();
  const tuples = [];
  for (const line of lines) {
    const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (header) {
      const tuple = [diagnosticFile(header[1]), Number(header[2]), Number(header[3]), Number(header[4]), diagnosticMessage(header[5])];
      if (tuple[3] === 2307) fail('missing-module setup diagnostic');
      tuples.push(tuple);
    } else {
      if (!/^ {2,}\S.*$/.test(line) || tuples.length === 0) fail('unlocated or unconsumed compiler output');
      tuples.at(-1)[4] += '\n' + diagnosticMessage(line);
    }
  }
  return tuples;
}

const markerNames = new Set();
function sourceCases(text, lane) {
  if (/@ts-(?:expect-error|ignore|nocheck)\b/.test(text)) fail('suppressed consumer diagnostic');
  const lines = text.split(/\r?\n/), cases = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes('SS_TYPE_CASE')) continue;
    const marker = /^\/\/ SS_TYPE_CASE (SS1-[NI]\d{2}): (.+)$/.exec(lines[index]);
    const prefix = lane === 'negative' ? 'SS1-N' : 'SS1-I';
    if (lane === 'positive' || !marker || !marker[1].startsWith(prefix) || markerNames.has(marker[1])
      || !lines[index + 1]?.trim() || /^\s*\/\//.test(lines[index + 1])) fail('malformed, duplicate or unassigned source marker');
    markerNames.add(marker[1]);
    cases.push({ name: marker[1], markerLine: index + 1, statementLine: index + 2,
      statement: lines[index + 1], sourceIntent: marker[2] });
  }
  return cases;
}

if (inventory.schemaVersion !== 1 || inventory.kind !== 'SPRITESHEET_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'
  || !equal(inventory.tupleFormat, ['file', 'line', 'column', 'code', 'message'])
  || inventory.compiler?.name !== 'typescript' || inventory.compiler.version !== '7.0.2'
  || inventory.compiler.entry !== 'node_modules/typescript/bin/tsc') fail('wrong frozen inventory or compiler');
const compilerPaths = ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc',
  'node_modules/typescript/lib/tsc.js', 'node_modules/typescript/lib/getExePath.js', 'pnpm-lock.yaml'];
if (!equal(inventory.compiler.pins?.map(pin => pin.path), compilerPaths)) fail('wrong compiler input inventory');
for (const pin of inventory.compiler.pins) readPin(pin);
const metadata = JSON.parse(readPin(inventory.compiler.pins[0]).toString('utf8'));
if (metadata.name !== 'typescript' || metadata.version !== '7.0.2'
  || !equal(metadata.bin, { tsc: './bin/tsc' }) || metadata.imports?.['#getExePath'] !== './lib/getExePath.js') fail('compiler metadata or launcher changed');

const dependenciesOwner = realpathSync(path.join(root, 'node_modules'));
function installedOwner(owner) {
  const relative = path.relative(dependenciesOwner, owner);
  if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) fail('compiler owner escaped installed dependencies');
}
const metadataOwner = realpathSync(path.join(root, compilerPaths[0]));
const compilerOwner = path.dirname(metadataOwner);
installedOwner(compilerOwner);
for (const file of compilerPaths.slice(1, 4)) {
  const expected = path.join(compilerOwner, file.slice('node_modules/typescript/'.length));
  if (!samePhysicalPath(realpathSync(path.join(root, file)), expected)) fail('compiler launcher file has a different physical owner');
}
const requireFromCompiler = createRequire(metadataOwner);
const nativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
const nativeMetadataOwner = realpathSync(requireFromCompiler.resolve(nativeName + '/package.json'));
const nativeOwner = path.dirname(nativeMetadataOwner);
installedOwner(nativeOwner);
const nativeBinary = process.platform === 'win32' ? 'lib/tsc.exe' : 'lib/tsc';
const nativeMetadata = JSON.parse(readFileSync(nativeMetadataOwner, 'utf8'));
if (nativeMetadata.name !== nativeName || nativeMetadata.version !== '7.0.2'
  || !equal(nativeMetadata.os, [process.platform]) || !equal(nativeMetadata.cpu, [process.arch])
  || metadata.optionalDependencies?.[nativeName] !== '7.0.2') fail('standard native compiler owner/version mismatch');
if (!statSync(path.join(nativeOwner, nativeBinary)).isFile()) fail('native compiler binary missing');
if (!samePhysicalPath(realpathSync(path.join(nativeOwner, nativeBinary)), path.join(nativeOwner, nativeBinary))) fail('native compiler binary has a different physical owner');

// Match only the current native package in the locked package/snapshot sections.
const lockLines = readPin(inventory.compiler.pins[4]).toString('utf8').replaceAll('\r\n', '\n').split('\n');
function lockedEntry(section) {
  const sections = lockLines.flatMap((line, index) => line === section + ':' ? [index] : []);
  if (sections.length !== 1) fail('ambiguous compiler lock section');
  const next = lockLines.findIndex((line, index) => index > sections[0] && /^[A-Za-z][A-Za-z0-9]*:$/.test(line));
  const stop = next === -1 ? lockLines.length : next;
  const header = "  '" + nativeName + "@7.0.2':", entries = [];
  for (let index = sections[0] + 1; index < stop; index++) if (lockLines[index] === header) entries.push(index);
  if (entries.length !== 1) fail('missing/duplicate locked native compiler owner');
  let end = entries[0] + 1;
  while (end < stop && (lockLines[end] === '' || lockLines[end].startsWith('    '))) end++;
  return lockLines.slice(entries[0] + 1, end).filter(line => line !== '');
}
const lockedPackage = lockedEntry('packages');
if (!lockedPackage.some(line => /^    resolution: \{integrity: sha512-[A-Za-z0-9+/]+=*\}$/.test(line))
  || !lockedPackage.includes('    os: [' + process.platform + ']')
  || !lockedPackage.includes('    cpu: [' + process.arch + ']')
  || !equal(lockedEntry('snapshots'), ['    optional: true'])) fail('native compiler lock ownership changed');

const configPaths = ['tsconfig.base.json', 'tests/types/tsconfig.json', 'tests/types/tsconfig.dom-free.json'];
if (!equal(inventory.configurationPins?.map(pin => pin.path), configPaths)) fail('wrong strict parent configuration closure');
const [base, shared, domFree] = inventory.configurationPins.map(pin => JSON.parse(readPin(pin).toString('utf8')));
const strictFlags = ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes',
  'verbatimModuleSyntax', 'noImplicitOverride', 'noEmitOnError'];
if (strictFlags.some(flag => base.compilerOptions?.[flag] !== true)
  || base.compilerOptions.target !== 'ES2022' || base.compilerOptions.module !== 'NodeNext'
  || base.compilerOptions.moduleResolution !== 'NodeNext' || !equal(base.compilerOptions.lib, ['ES2022'])
  || !equal(base.compilerOptions.types, []) || shared.extends !== '../../tsconfig.base.json'
  || shared.compilerOptions?.noEmit !== true || domFree.extends !== './tsconfig.json') fail('strict DOM/Node-free inheritance changed');

const laneNames = ['positive', 'negative', 'import-negative'];
if (!equal(inventory.groups?.map(group => group.lane), laneNames)) fail('wrong original consumer lanes');
const frozenTuples = new Set();
const trials = inventory.groups.map(group => {
  const file = 'tests/types/spritesheet-' + group.lane + '.ts';
  const config = 'tests/types/tsconfig.spritesheet-' + group.lane + '.json';
  if (group.fixture?.path !== file || group.config?.path !== config
    || group.expectedExit !== (group.lane === 'positive' ? 0 : 1)) fail('wrong original fixture/config/exit');
  const text = readPin(group.fixture).toString('utf8');
  const parsedConfig = JSON.parse(readPin(group.config).toString('utf8'));
  const options = parsedConfig.compilerOptions;
  if (parsedConfig.extends !== './tsconfig.dom-free.json' || !equal(parsedConfig.include, [path.basename(file)])
    || strictFlags.some(flag => options?.[flag] !== true) || options.noEmit !== true || options.skipLibCheck !== false
    || options.composite !== false || options.declaration !== false || options.declarationMap !== false
    || options.target !== 'ES2022' || options.module !== 'NodeNext' || options.moduleResolution !== 'NodeNext'
    || !equal(options.lib, ['ES2022']) || !equal(options.types, [])) fail('strict original consumer config changed');
  const cases = sourceCases(text, group.lane);
  if (!Array.isArray(group.cases) || group.cases.length !== cases.length) fail('source-marker/tuple inventory is not bijective');
  for (let index = 0; index < cases.length; index++) {
    const frozen = group.cases[index], source = cases[index], tuple = frozen.tuple;
    if (frozen.name !== source.name || frozen.markerLine !== source.markerLine || frozen.statementLine !== source.statementLine
      || frozen.statement !== source.statement || frozen.sourceIntent !== source.sourceIntent
      || !Array.isArray(tuple) || tuple.length !== 5 || tuple[0] !== file || tuple[1] !== source.statementLine
      || !Number.isSafeInteger(tuple[2]) || tuple[2] < 1 || tuple[2] > source.statement.length
      || !Number.isSafeInteger(tuple[3]) || tuple[3] < 1 || tuple[3] === 2307
      || typeof tuple[4] !== 'string' || !tuple[4] || tuple[4].includes('\r')
      || tuple[4].split('\n').slice(1).some(line => !/^ {2,}\S.*$/.test(line))) fail('assigned source position or complete frozen message changed');
    const key = JSON.stringify(tuple);
    if (frozenTuples.has(key)) fail('duplicate frozen diagnostic');
    frozenTuples.add(key);
  }
  return { group, file, config };
});

function fileWitness(logical) {
  const physical = realpathSync(logical), bytes = readFileSync(logical);
  return { logical, physical, bytes: bytes.length, sha256: hash(bytes) };
}
function declarationWitness() {
  const rows = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail('declaration graph contains a symbolic link');
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.d.ts')) rows.push(fileWitness(file));
    }
  }
  for (const name of ['contracts', 'runtime', 'engine', 'project']) {
    const logical = path.join(root, 'node_modules/@egret', name), owner = realpathSync(logical);
    if (owner !== realpathSync(path.join(root, 'packages', name))) fail('public workspace alias changed: ' + name);
    rows.push({ alias: name, logical, physical: owner });
    rows.push(fileWitness(path.join(owner, 'package.json')));
    visit(path.join(owner, 'dist'));
  }
  return rows;
}
function currentWitness() {
  return { root: realpathSync(root), dependencies: realpathSync(path.join(root, 'node_modules')),
    compiler: compilerPaths.slice(0, 4).map(file => fileWitness(path.join(root, file))),
    nativeMetadataResolution: realpathSync(requireFromCompiler.resolve(nativeName + '/package.json')),
    native: ['package.json', nativeBinary].map(file => fileWitness(path.join(nativeOwner, file))),
    runtime: fileWitness(process.execPath), declarations: declarationWitness() };
}
const ownersBefore = currentWitness();
function recheck() {
  readPin(inventoryPin); readPin(selfPin);
  for (const pin of inventory.compiler.pins) readPin(pin);
  for (const pin of inventory.configurationPins) readPin(pin);
  for (const trial of trials) { readPin(trial.group.fixture); readPin(trial.group.config); }
  if (!equal(currentWitness(), ownersBefore)) fail('compiler/runtime/declaration owner, graph or bytes changed during gate');
}

const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete environment[key];
}
// Positive setup completes first; negatives must never qualify a broken installation.
for (const trial of trials) {
  recheck();
  const result = spawnSync(process.execPath, [inventory.compiler.entry, '-p', trial.config],
    { cwd: root, encoding: 'utf8', windowsHide: true, env: environment, timeout: 30000, maxBuffer: 4194304 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  recheck();
  if (result.error || result.signal !== null || result.status !== trial.group.expectedExit) {
    throw result.error ?? Error('SpriteSheet types: compiler setup/interruption/exit refused in ' + trial.group.lane);
  }
  const observed = parseDiagnostics(result.stdout ?? '', result.stderr ?? '');
  const expected = trial.group.cases.map(item => item.tuple);
  if (observed.some(tuple => tuple[0] !== trial.file) || new Set(observed.map(tuple => JSON.stringify(tuple))).size !== observed.length
    || !equal(observed, expected)) fail('missing/extra/duplicate or changed complete diagnostic in ' + trial.group.lane);
  console.log('SpriteSheet ' + trial.group.lane + ' live exact diagnostics: ' + JSON.stringify(
    trial.group.cases.map((item, index) => ({ name: item.name, expected: item.tuple, actual: observed[index] }))));
}
recheck();
console.log('SpriteSheet current native compiler witness: ' + JSON.stringify({ package: nativeName,
  version: nativeMetadata.version, platform: process.platform, arch: process.arch,
  pins: ownersBefore.native.map((pin, index) => ({ path: index === 0 ? 'package.json' : nativeBinary, bytes: pin.bytes, sha256: pin.sha256 })) }));
console.log('SpriteSheet types PASS: fresh strict positive and complete unsuppressed diagnostics.');
