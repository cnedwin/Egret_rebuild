// SPDX-License-Identifier: Apache-2.0
// This gate freezes complete observed TypeScript diagnostics, not runtime acceptance.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintFile, logicalPath, ownerRelativePath } from './lib/file-identity.mjs';

const seqpRoot = fileURLToPath(new URL('../', import.meta.url));
const seqpInventoryPath = 'tests/types/sequence-playback-diagnostic-expectations.json';
const seqpInventory = JSON.parse(readFileSync(path.join(seqpRoot, seqpInventoryPath), 'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(seqpRoot, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== 'fbd03171b35322e72d32f3e9d504e8567e5cb46655394d6097d2fe9d6fc2bf52') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(seqpRoot, 'sequence-playback', seqpInventory);

const seqpFail = message => { throw Error('Sequence playback types: ' + message); };
const seqpEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const seqpPinPaths = pins => pins.map(pin => pin.path);
const seqpHash = bytes => createHash('sha256').update(bytes).digest('hex');

function seqpReadPin(pin, owner = seqpRoot) {
  if (!pin || typeof pin.path !== 'string' || pin.path.includes('\\') || path.isAbsolute(pin.path)
    || pin.path.split('/').some(part => !part || part === '.' || part === '..')
    || !Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[0-9a-f]{64}$/.test(pin.sha256)) {
    seqpFail('invalid relative source pin');
  }
  const bytes = readFileSync(path.join(owner, pin.path));
  if (bytes.length !== pin.bytes || seqpHash(bytes) !== pin.sha256) seqpFail('source/config/compiler identity changed: ' + pin.path);
  return bytes;
}

function seqpFile(file) {
  const portable = file.replaceAll('\\', '/');
  if (path.isAbsolute(file) || /^[A-Za-z]:\//.test(portable) || portable.startsWith('/')) {
    try { return ownerRelativePath(path.resolve(seqpRoot), file); }
    catch { seqpFail('diagnostic outside the current repository root'); }
  }
  try { return logicalPath(portable); }
  catch { seqpFail('noncanonical diagnostic filename'); }
}

// Every nonempty line must be a full header or an indented continuation.
// Indentation and complete message text survive parsing; nothing is trimmed.
function seqpParse(stdout, stderr) {
  if (stderr !== '') seqpFail('compiler stderr or setup failure');
  if (stdout === '') return [];
  const normalized = stdout.replaceAll('\r\n', '\n');
  if (normalized.includes('\r') || !normalized.endsWith('\n')) seqpFail('incomplete compiler output');
  const lines = normalized.split('\n');
  lines.pop();
  const diagnostics = [];
  for (const line of lines) {
    const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (header) {
      diagnostics.push([seqpFile(header[1]), Number(header[2]), Number(header[3]), Number(header[4]), header[5]]);
    } else {
      if (!/^ {2,}\S.*$/.test(line) || diagnostics.length === 0) seqpFail('unconsumed compiler output');
      diagnostics.at(-1)[4] += '\n' + line;
    }
  }
  return diagnostics;
}

const seqpNames = new Set();
function seqpCases(text, lane) {
  if (/@ts-(?:expect-error|ignore|nocheck)\b/.test(text)) seqpFail('suppressed consumer diagnostic');
  const lines = text.split(/\r?\n/);
  const cases = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes('SEQP_TYPE_CASE')) continue;
    const marker = /^\s*\/\/ SEQP_TYPE_CASE (SEQP-[NI]\d{2})$/.exec(lines[index]);
    const prefix = lane === 'negative' ? 'SEQP-N' : 'SEQP-I';
    if (lane === 'positive' || !marker || !marker[1].startsWith(prefix) || seqpNames.has(marker[1])
      || !lines[index + 1]?.trim() || /^\s*\/\//.test(lines[index + 1])) seqpFail('malformed, duplicate or unassigned marker');
    seqpNames.add(marker[1]);
    cases.push({ name: marker[1], markerLine: index + 1, statementLine: index + 2, statement: lines[index + 1] });
  }
  return cases;
}

if (seqpInventory.schemaVersion !== 1 || seqpInventory.kind !== 'SEQUENCE_PLAYBACK_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS'
  || !seqpEqual(seqpInventory.tupleFormat, ['file', 'line', 'column', 'code', 'completeMessage'])
  || seqpInventory.compiler?.name !== 'typescript' || seqpInventory.compiler.version !== '7.0.2'
  || seqpInventory.compiler.entry !== 'node_modules/typescript/bin/tsc') seqpFail('wrong frozen inventory or compiler');
const seqpCompilerPaths = ['node_modules/typescript/package.json', 'node_modules/typescript/bin/tsc',
  'node_modules/typescript/lib/tsc.js', 'node_modules/typescript/lib/getExePath.js', 'pnpm-lock.yaml'];
if (!seqpEqual(seqpPinPaths(seqpInventory.compiler.pins), seqpCompilerPaths)) seqpFail('wrong compiler owner inventory');
for (const pin of m13?.compilerPins ?? seqpInventory.compiler.pins) seqpReadPin(pin);
const seqpMetadata = JSON.parse(readFileSync(path.join(seqpRoot, seqpCompilerPaths[0]), 'utf8'));
if (seqpMetadata.name !== 'typescript' || seqpMetadata.version !== '7.0.2'
  || !seqpEqual(seqpMetadata.bin, { tsc: './bin/tsc' })
  || seqpMetadata.imports?.['#getExePath'] !== './lib/getExePath.js') seqpFail('compiler version or launcher changed');

// The observed Windows hashes are provenance, not a host allowlist.
// The pinned standard launcher determines the current optional native owner.
const seqpNativeName = '@typescript/typescript-' + process.platform + '-' + process.arch;
const seqpDependenciesRoot = realpathSync(path.join(seqpRoot, 'node_modules'));
function seqpInstalledOwner(owner) {
  const relative = path.relative(seqpDependenciesRoot, owner);
  if (path.isAbsolute(relative) || relative.startsWith('..') || !relative) seqpFail('compiler owner escaped installed dependencies');
}
const seqpCompilerMetadataPath = realpathSync(path.join(seqpRoot, 'node_modules/typescript/package.json'));
seqpInstalledOwner(path.dirname(seqpCompilerMetadataPath));
const seqpRequire = createRequire(seqpCompilerMetadataPath);
const seqpNativeMetadataPath = realpathSync(seqpRequire.resolve(seqpNativeName + '/package.json'));
const seqpNativeRoot = path.dirname(seqpNativeMetadataPath);
seqpInstalledOwner(seqpNativeRoot);
const seqpNativeBinary = process.platform === 'win32' ? 'lib/tsc.exe' : 'lib/tsc';
const seqpNativeMetadata = JSON.parse(readFileSync(seqpNativeMetadataPath, 'utf8'));
if (seqpNativeMetadata.name !== seqpNativeName || seqpNativeMetadata.version !== '7.0.2'
  || !seqpEqual(seqpNativeMetadata.os, [process.platform]) || !seqpEqual(seqpNativeMetadata.cpu, [process.arch])
  || seqpMetadata.optionalDependencies?.[seqpNativeName] !== '7.0.2') seqpFail('standard native compiler owner/version mismatch');

// Read only the exact native entry in each pinned lockfile section.
// No general YAML parser or substring/version inference is used.
const seqpLockLines = readFileSync(path.join(seqpRoot, 'pnpm-lock.yaml'), 'utf8').replaceAll('\r\n', '\n').split('\n');
function seqpLockedEntry(section, name) {
  const starts = seqpLockLines.flatMap((line, index) => line === section + ':' ? [index] : []);
  if (starts.length !== 1) seqpFail('ambiguous native compiler lock section');
  const end = seqpLockLines.findIndex((line, index) => index > starts[0] && /^[A-Za-z][A-Za-z0-9]*:$/.test(line));
  const stop = end === -1 ? seqpLockLines.length : end;
  const header = "  '" + name + "@7.0.2':";
  const entries = [];
  for (let index = starts[0] + 1; index < stop; index++) if (seqpLockLines[index] === header) entries.push(index);
  if (entries.length !== 1) seqpFail('missing/duplicate locked native compiler owner');
  let until = entries[0] + 1;
  while (until < stop && (seqpLockLines[until] === '' || seqpLockLines[until].startsWith('    '))) until++;
  return seqpLockLines.slice(entries[0] + 1, until).filter(line => line !== '');
}
const seqpLockedPackage = seqpLockedEntry('packages', seqpNativeName);
if (!seqpLockedPackage.some(line => /^    resolution: \{integrity: sha512-[A-Za-z0-9+/]+=*\}$/.test(line))
  || !seqpLockedPackage.includes('    os: [' + process.platform + ']')
  || !seqpLockedPackage.includes('    cpu: [' + process.arch + ']')
  || !seqpEqual(seqpLockedEntry('snapshots', seqpNativeName), ['    optional: true'])) seqpFail('native compiler lock ownership changed');
const seqpNativeCurrentPins = ['package.json', seqpNativeBinary].map(file => {
  const bytes = readFileSync(path.join(seqpNativeRoot, file));
  return { path: file, bytes: bytes.length, sha256: seqpHash(bytes) };
});
console.log('Sequence playback current native compiler witness: ' + JSON.stringify({
  package: seqpNativeName, version: seqpNativeMetadata.version, platform: process.platform, arch: process.arch, pins: seqpNativeCurrentPins,
}));

const seqpConfigPaths = ['tsconfig.base.json', 'tests/types/tsconfig.json', 'tests/types/tsconfig.dom-free.json'];
if (!seqpEqual(seqpPinPaths(seqpInventory.configurationPins), seqpConfigPaths)) seqpFail('wrong strict configuration closure');
for (const pin of seqpInventory.configurationPins) seqpReadPin(pin);
const seqpBase = JSON.parse(readFileSync(path.join(seqpRoot, seqpConfigPaths[0]), 'utf8'));
const seqpShared = JSON.parse(readFileSync(path.join(seqpRoot, seqpConfigPaths[1]), 'utf8'));
const seqpDOMFree = JSON.parse(readFileSync(path.join(seqpRoot, seqpConfigPaths[2]), 'utf8'));
const seqpStrict = ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes',
  'verbatimModuleSyntax', 'noImplicitOverride', 'noEmitOnError'];
if (seqpStrict.some(flag => seqpBase.compilerOptions?.[flag] !== true)
  || seqpBase.compilerOptions.target !== 'ES2022' || seqpBase.compilerOptions.module !== 'NodeNext'
  || seqpBase.compilerOptions.moduleResolution !== 'NodeNext'
  || !seqpEqual(seqpBase.compilerOptions.lib, ['ES2022']) || !seqpEqual(seqpBase.compilerOptions.types, [])
  || seqpShared.extends !== '../../tsconfig.base.json' || seqpShared.compilerOptions?.noEmit !== true
  || seqpDOMFree.extends !== './tsconfig.json') seqpFail('strict DOM/Node-free inheritance changed');

const seqpLanes = ['positive', 'negative', 'import-negative'];
if (!seqpEqual(seqpInventory.groups?.map(group => group.lane), seqpLanes)) seqpFail('wrong original consumer lanes');
const seqpTrials = seqpInventory.groups.map(group => {
  const file = 'tests/types/sequence-playback-' + group.lane + '.ts';
  const config = 'tests/types/tsconfig.sequence-playback-' + group.lane + '.json';
  if (group.fixture?.path !== file || group.config?.path !== config
    || group.expectedExit !== (group.lane === 'positive' ? 0 : 1)) seqpFail('wrong original consumer/config/exit');
  const text = seqpReadPin(group.fixture).toString('utf8');
  const parsedConfig = JSON.parse(seqpReadPin(group.config).toString('utf8'));
  const options = parsedConfig.compilerOptions;
  if (parsedConfig.extends !== './tsconfig.dom-free.json'
    || !seqpEqual(parsedConfig.include, [path.basename(file)])
    || seqpStrict.some(flag => options?.[flag] !== true) || options.noEmit !== true
    || options.skipLibCheck !== false || options.composite !== false
    || options.declaration !== false || options.declarationMap !== false
    || options.target !== 'ES2022' || options.module !== 'NodeNext' || options.moduleResolution !== 'NodeNext'
    || !seqpEqual(options.lib, ['ES2022']) || !seqpEqual(options.types, [])) seqpFail('strict original consumer config changed');
  const sourceCases = seqpCases(text, group.lane);
  if (!Array.isArray(group.cases) || group.cases.length !== sourceCases.length) seqpFail('marker/tuple inventory is not bijective');
  const tuples = new Set();
  for (let index = 0; index < group.cases.length; index++) {
    const frozen = group.cases[index], source = sourceCases[index], tuple = frozen.tuple;
    if (frozen.name !== source.name || frozen.markerLine !== source.markerLine || !Array.isArray(tuple) || tuple.length !== 5
      || tuple[0] !== file || tuple[1] !== source.statementLine || !Number.isSafeInteger(tuple[2]) || tuple[2] < 1
      || tuple[2] > source.statement.length || !Number.isSafeInteger(tuple[3]) || tuple[3] < 1
      || typeof tuple[4] !== 'string' || tuple[4].length === 0 || tuple[4].includes('\r')
      || tuple[4].split('\n').slice(1).some(line => !/^ {2,}\S.*$/.test(line))) seqpFail('assigned source position or complete frozen message changed');
    const key = JSON.stringify(tuple);
    if (tuples.has(key)) seqpFail('duplicate frozen diagnostic tuple');
    tuples.add(key);
  }
  // Preserve and validate every historical named tuple above before selecting
  // the separately authenticated current Bitmap-shape negative vector.
  const expectedCurrentSourcePins = [{"path":"packages/runtime/src/DisplayObject.ts","bytes":5566,"sha256":"e50f33d0d107ffa9176854ad08f8e153ca6991af1604adf3affd6497d7d156b3"},{"path":"packages/runtime/dist/DisplayObject.d.ts","bytes":2555,"sha256":"508cab574f1552cbfd3af464173b03fdb83f7ec774872bc658bca6a3ceb3c732"}];
  // M1.2 changes implementation revisions only; the inherited declaration and
  // every saved negative tuple remain the original observed values.
  const m12IncrementalSourcePins = [{"path":"packages/runtime/src/DisplayObject.ts","bytes":7011,"sha256":"3cb67df2b19e006674e60bb60c990198005d3e1446c85a9f78e62a6fc44a6817"},{"path":"packages/runtime/dist/DisplayObject.d.ts","bytes":2555,"sha256":"508cab574f1552cbfd3af464173b03fdb83f7ec774872bc658bca6a3ceb3c732"}];
  const successor = seqpInventory.currentDeclarationSuccessor;
  if (successor?.schemaVersion !== 1 || successor.kind !== 'ANCHOR_INHERITED_BITMAP_CURRENT_NEGATIVE_DIAGNOSTIC_SUCCESSOR'
    || successor.status !== 'SAVED_GENUINE_CURRENT_COMPILER_OBSERVATION_NEW_GATE_NOT_RUN'
    || successor.lane !== 'negative' || successor.expectedExit !== 1
    || !seqpEqual(successor.sourcePins, expectedCurrentSourcePins)) seqpFail('current source successor changed');
  if (!seqpEqual(seqpPinPaths(m12IncrementalSourcePins), seqpPinPaths(expectedCurrentSourcePins))
    || !seqpEqual(m12IncrementalSourcePins[1], expectedCurrentSourcePins[1])) seqpFail('incremental source successor shape changed');
  // Select a complete recorded pair. Neither a source-only match nor an
  // unchanged declaration can authorize any unregistered implementation.
  const actualCurrentSourcePins = expectedCurrentSourcePins.map(pin => {
    const bytes = readFileSync(path.join(seqpRoot, pin.path));
    return { path: pin.path, bytes: bytes.length, sha256: seqpHash(bytes) };
  });
  const currentSourcePins = m13 ? expectedCurrentSourcePins.map(pin => m13.pin(pin.path))
    : seqpEqual(actualCurrentSourcePins, expectedCurrentSourcePins) ? expectedCurrentSourcePins : m12IncrementalSourcePins;
  for (const pin of currentSourcePins) seqpReadPin(pin);
  let currentCases = group.cases;
  if (group.lane === 'negative') {
    const expectedRaw = {"bytes":4133,"sha256":"6c19f988695b1e37c5e756c79596da4f60ad0ecb5cba90d2a619260ac9a85e86"};
    const original = successor.observedExecution;
    if (!seqpEqual(successor.fixture, group.fixture) || !seqpEqual(successor.config, group.config)
      || !original || original.exitCode !== 1 || original.timeout !== false
      || !seqpEqual(original.stdout, expectedRaw) || original.stderr?.bytes !== 0
      || original.stderr.sha256 !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      || original.receiptSHA256 !== '90cac61810b3e1c3641835fea219c06b61a5ce162c366740d440f64259718367'
      || typeof successor.originalStdout !== 'string' || !Array.isArray(successor.cases)
      || successor.cases.length !== group.cases.length) seqpFail('current negative provenance differs');
    const bytes = Buffer.from(successor.originalStdout, 'utf8');
    if (bytes.length !== expectedRaw.bytes || seqpHash(bytes) !== expectedRaw.sha256
      || !seqpEqual(seqpParse(bytes.toString('utf8'), ''), successor.cases.map(item=>item.tuple)))
      seqpFail('current complete raw negative diagnostics differ');
    for (let index = 0; index < group.cases.length; index++) {
      const current = successor.cases[index], historical = group.cases[index];
      if (current.name !== historical.name || current.markerLine !== historical.markerLine
        || !Array.isArray(current.tuple) || current.tuple.length !== 5
        || !seqpEqual(current.tuple.slice(0,4), historical.tuple.slice(0,4)))
        seqpFail('current named source intent or tuple location differs');
    }
    currentCases = successor.cases;
  }
  if (m13) currentCases = currentCases.map((item, index) => ({...item, tuple:m13.group(group.lane).tuples[index]}));
  return { group, file, config, currentCases, currentSourcePins };
});

const seqpEnvironment = { ...process.env };
for (const key of Object.keys(seqpEnvironment)) {
  if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete seqpEnvironment[key];
}
function seqpRecheck(trial) {
  m13?.recheck();
  for (const pin of m13?.compilerPins ?? seqpInventory.compiler.pins) seqpReadPin(pin);
  for (const pin of seqpNativeCurrentPins) seqpReadPin(pin, seqpNativeRoot);
  for (const pin of seqpInventory.configurationPins) seqpReadPin(pin);
  seqpReadPin(trial.group.fixture);
  seqpReadPin(trial.group.config);
  for (const pin of trial.currentSourcePins) seqpReadPin(pin);
}
// Positive controls execute first. Negatives never substitute for a missing setup.
for (const trial of seqpTrials) {
  seqpRecheck(trial);
  const result = spawnSync(process.execPath, [path.join(seqpRoot, seqpInventory.compiler.entry),
    '--project', trial.config, '--pretty', 'false'],
  { cwd: seqpRoot, encoding: 'utf8', windowsHide: true, env: seqpEnvironment, timeout: 30000, maxBuffer: 4194304 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error || result.signal !== null || result.status !== trial.group.expectedExit) {
    throw result.error ?? Error('Sequence playback types: compiler setup/interruption/exit refused in ' + trial.group.lane);
  }
  seqpRecheck(trial);
  const observed = seqpParse(result.stdout ?? '', result.stderr ?? '');
  const expected = trial.currentCases.map(item => item.tuple);
  if (observed.some(item => item[0] !== trial.file) || new Set(observed.map(item => JSON.stringify(item))).size !== observed.length
    || !seqpEqual(observed, expected)) seqpFail('missing/extra/duplicate or changed complete diagnostic in ' + trial.group.lane);
  m13?.verifyClosure(trial.group.lane);
  console.log('Sequence playback ' + trial.group.lane + ' live exact diagnostics: ' + JSON.stringify(
    trial.currentCases.map((item, index) => ({ name: item.name, expected: item.tuple, actual: observed[index] }))));
}
console.log('Sequence playback types PASS: fresh strict positive and complete unsuppressed marker diagnostics; runtime acceptance remains separate.');
