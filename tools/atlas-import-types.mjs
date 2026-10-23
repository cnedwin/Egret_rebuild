// SPDX-License-Identifier: Apache-2.0
// Replay actual unsuppressed public consumers; importing this tool runs nothing.
import {spawnSync} from 'node:child_process';
import {readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintFile, samePhysicalPath, ownerRelativePath} from './lib/file-identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if (m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb') throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');

const inventoryPin = {"path":"tests/types/atlas-import-diagnostic-expectations.json","bytes":254943,"sha256":"3d59e24a78708bd0d85f06d6124bced00d5687afcc494d1e919dce1fc9a985c6"};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function refuse(code, detail) { const error = new Error(code + ': ' + detail); error.code = code; throw error; }
function readInventory() {
  if (!samePhysicalPath(root, realpathSync(root), process.platform)) refuse('ATLAS_GATE_OWNER', 'canonical physical owner required');
  const current = fingerprintFile(root, inventoryPin.path);
  if (!same(current, inventoryPin)) refuse('ATLAS_GATE_INVENTORY', 'observed inventory changed');
  return JSON.parse(readFileSync(path.join(root, inventoryPin.path), 'utf8'));
}
function authenticateAliases() {
  for (const name of ['project', 'engine', 'runtime', 'contracts']) {
    const actual = realpathSync(path.join(root, 'node_modules/@egret', name));
    const expected = realpathSync(path.join(root, 'packages', name));
    if (!samePhysicalPath(actual, expected, process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign public owner: ' + name);
    const entry = fileURLToPath(import.meta.resolve('@egret/' + name));
    if (!samePhysicalPath(realpathSync(entry), path.join(expected, 'dist/index.js'), process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign built entry: ' + name);
  }
  const optional = fileURLToPath(import.meta.resolve('@egret/project/atlas'));
  if (!samePhysicalPath(realpathSync(optional), path.join(root, 'packages/project/dist/atlas/index.js'), process.platform)) refuse('ATLAS_GATE_ALIAS', 'foreign optional entry');
}
function checkPin(pin, code) { if (!same(fingerprintFile(root, pin.path), pin)) refuse(code, pin.path); }

export function parseAtlasImportDiagnostics(raw) {
  const rows = [];
  for (const line of raw.replaceAll('\r\n', '\n').split('\n')) {
    if (line === '') continue;
    const match = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(line);
    if (match) rows.push([match[1].replaceAll('\\', '/'), Number(match[2]), Number(match[3]), Number(match[4]), match[5]]);
    else if (/^ {2,}\S/.test(line) && rows.length) rows.at(-1)[4] += '\n' + line;
    else refuse('ATLAS_TYPES_OUTPUT', 'unconsumed compiler output');
  }
  return rows;
}
export function runAtlasImportTypes() {
  const inventory = readInventory();
  const m13 = selectM13StrictSuccessor(root, 'atlas-import', inventory);
  if (inventory.kind !== 'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS' || inventory.status !== 'OBSERVED_FROZEN_TS7_DIAGNOSTICS'
      || !same(inventory.groups.map(g => g.lane), ['positive', 'negative', 'import-negative'])) refuse('ATLAS_TYPES_OBSERVATION', 'actual three-lane observation required');
  authenticateAliases();
  const verify = () => { m13?.recheck(); for (const pin of m13?.inputPins ?? inventory.inputPins) checkPin(pin, 'ATLAS_TYPES_IDENTITY'); };
  verify();
  const environment = {...process.env};
  for (const key of Object.keys(environment)) if (/^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID|DOTNET_STARTUP_HOOKS|DOTNET_ADDITIONAL_DEPS|DOTNET_SHARED_STORE)$/i.test(key)) delete environment[key];
  for (const group of inventory.groups) {
    verify();
    const source = readFileSync(path.join(root, group.fixture.path), 'utf8');
    if (/@ts-(?:ignore|expect-error|nocheck)/.test(source)) refuse('ATLAS_TYPES_SUPPRESSION', group.fixture.path);
    const marker = '// ATLAS_IMPORT_CASE ';
    const cases = source.split('\n').flatMap((line, i) => line.startsWith(marker) ? [{name:line.slice(marker.length), line:i+2}] : []);
    if (!same(cases, group.cases) || !same(cases.map(c => c.line), group.tuples.map(t => t[1]))
        || group.tuples.some(t => t[0] !== group.fixture.path)) refuse('ATLAS_TYPES_CASES', 'named complete tuple mapping changed');
    const args = ['node_modules/typescript/bin/tsc', '-p', group.config.path, '--pretty', 'false'];
    const result = spawnSync(process.execPath, args, {cwd:root, env:environment, encoding:'utf8', windowsHide:true, timeout:60000, maxBuffer:4194304});
    process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
    verify();
    if (result.error || result.signal || result.status !== group.expectedExit || result.stderr !== ''
        || !same(parseAtlasImportDiagnostics(result.stdout), m13?.group(group.lane).tuples ?? group.tuples)) refuse('ATLAS_TYPES_TUPLES', 'actual exit/file/line/column/code/full-message mismatch: ' + group.lane);
    const listed = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', group.config.path, '--listFilesOnly', '--pretty', 'false'], {cwd:root, env:environment, encoding:'utf8', windowsHide:true, timeout:60000, maxBuffer:4194304});
    if (listed.error || listed.signal || listed.status !== 0 || listed.stderr !== '') refuse('ATLAS_TYPES_CLOSURE', 'actual compiler closure listing failed');
    const closure = listed.stdout.split(/\r?\n/).filter(Boolean).map(file => ownerRelativePath(root, realpathSync(file), process.platform)).sort();
    if (!same(closure, m13?.group(group.lane).closure ?? group.closure)) refuse('ATLAS_TYPES_CLOSURE', 'declaration/library/source closure changed');
    m13?.verifyClosure(group.lane, listed);
    verify();
    console.log('Atlas import strict ' + group.lane + ' PASS ' + JSON.stringify(m13?.group(group.lane).tuples ?? group.tuples));
  }
  console.log('Atlas import strict public consumers PASS; runtime and browser acceptance remain separate.');
}
if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url), process.platform)) {
  if (process.argv.length !== 2) refuse('ATLAS_TYPES_ARGUMENTS', 'direct CLI accepts no arguments');
  runAtlasImportTypes();
}
