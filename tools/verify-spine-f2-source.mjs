// SPDX-License-Identifier: Apache-2.0
// Opt-in development verification; SDK/core totals and experiment totals remain separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readF2SourceInput, checkF2SourceBoundary } from './spine-f2-source-boundary.mjs';

assert.equal(process.argv.length, 2, 'F2_VERIFY_NO_ARGUMENTS');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = path.join(root, 'knowledge-base/experiments/spine-f2');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const slashRoot = root.replaceAll('\\', '/');
const negativeFile = 'knowledge-base/experiments/spine-f2/type-tests/negative.ts';
const expectationFile = path.join(directory, 'type-tests/negative-expectations.json');
const compiler = path.join(root, 'node_modules/typescript/bin/tsc');

function expectations(tableFile = expectationFile, sourceFile = negativeFile) {
  if (!fs.existsSync(tableFile)) throw new Error('F2_TYPES_EXPECTATIONS_PENDING');
  const value = JSON.parse(fs.readFileSync(tableFile, 'utf8'));
  const metadata = ['schemaVersion', 'kind', 'compilerVersion', 'messageNormalization', 'diagnostics'];
  assert(Object.keys(value).every(key => metadata.includes(key)), 'F2_TYPES_EXPECTATIONS_SCHEMA');
  if (Object.hasOwn(value, 'schemaVersion')) assert.equal(value.schemaVersion, 1);
  if (Object.hasOwn(value, 'kind')) assert.equal(value.kind, 'ACTUAL_UNSUPPRESSED_COMPILER_DIAGNOSTICS');
  if (Object.hasOwn(value, 'compilerVersion')) assert.equal(value.compilerVersion, '7.0.2');
  if (Object.hasOwn(value, 'messageNormalization')) assert.equal(value.messageNormalization,
    'Only the exact repository root prefix is replaced by <repo>/. Raw private output is retained.');
  assert(Array.isArray(value.diagnostics) && value.diagnostics.length > 0, 'F2_TYPES_EXPECTATIONS_SCHEMA');
  for (const row of value.diagnostics) {
    assert.deepEqual(Object.keys(row).sort(), ['code', 'column', 'file', 'line', 'message']);
    assert.equal(row.file, sourceFile, 'F2_TYPES_EXPECTED_FILE');
    for (const field of ['line', 'column', 'code']) assert(Number.isSafeInteger(row[field]) && row[field] > 0);
    assert.equal(typeof row.message, 'string');
    assert(row.message.length > 0 && !row.message.includes(slashRoot + '/') && !row.message.includes(root + path.sep),
      'F2_TYPES_PUBLIC_MESSAGE_PATH');
  }
  return value.diagnostics;
}

function typeConfiguration(name, profile = false) {
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'type-tests/tsconfig.' + name + '.json'), 'utf8'));
  assert.deepEqual(Object.keys(config).sort(), ['compilerOptions', 'files'], 'F2_TYPES_CONFIG_SHAPE');
  assert.deepEqual(config.files, [name + '.ts'], 'F2_TYPES_CONFIG_FILES');
  assert.deepEqual(config.compilerOptions, { strict: true, target: 'ES2022', module: 'NodeNext',
    moduleResolution: 'NodeNext', lib: ['ES2022'], types: [], skipLibCheck: false, noEmit: true,
    ...(profile ? { noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
      verbatimModuleSyntax: true, noImplicitOverride: true, noEmitOnError: true } : {}) }, 'F2_TYPES_STRICT_CONFIG');
}

function run(name, args, expectedExit = 0) {
  console.log('F2_VERIFY ' + name);
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8',
    windowsHide: true, timeout: 180000, maxBuffer: 16000000 });
  // Raw streams are always surfaced before evaluating exit or exact diagnostics.
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'F2_VERIFY_CHILD_SIGNAL');
  assert.equal(result.status, expectedExit, 'F2_VERIFY_CHILD_EXIT_' + name);
  return result;
}

function diagnostics(output, sourceFile = negativeFile) {
  const rows = [];
  const lines = output.replaceAll('\r\n', '\n').split('\n');
  if (lines.at(-1) === '') lines.pop(); // Remove only the stream's final line terminator.
  for (const line of lines) {
    const header = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(line);
    if (header !== null) {
      let file = header[1].replaceAll('\\', '/');
      if (file.startsWith(slashRoot + '/')) file = file.slice(slashRoot.length + 1);
      assert.equal(file, sourceFile, 'F2_TYPES_UNRELATED_DIAGNOSTIC_FILE');
      rows.push({ file, line: Number(header[2]), column: Number(header[3]), code: Number(header[4]), message: header[5] });
    } else if (rows.length > 0 && (line.length === 0 || /^\s/.test(line))) {
      rows[rows.length - 1].message += '\n' + line;
    } else throw new Error('F2_TYPES_UNCLASSIFIED_COMPILER_OUTPUT');
  }
  for (const row of rows) {
    // Only the exact current repository prefix changes. Preserve complete message
    // wording and continuation indentation; never strip arbitrary diagnostic text.
    // Derive the compiler's escaped spelling from this owner only. Keep the
    // trailing separator so a sibling checkout cannot acquire its identity.
    const compilerRoot = slashRoot.replace(/[^\x20-\x7e]/g, unit =>
      '\\u' + unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    row.message = row.message.replaceAll(slashRoot + '/', '<repo>/')
      .replaceAll(root + path.sep, '<repo>/')
      .replaceAll(compilerRoot + '/', '<repo>/');
    if ([2307, 2688, 6053, 5083, 18003].includes(row.code)) throw new Error('F2_TYPES_SETUP_DIAGNOSTIC');
  }
  assert(rows.length > 0, 'F2_TYPES_NEGATIVE_DIAGNOSTICS_REQUIRED');
  return rows;
}

const expected = expectations();
typeConfiguration('positive');
typeConfiguration('negative');
const sourceBoundary = checkF2SourceBoundary(readF2SourceInput(root));
console.log('F2_SOURCE_BOUNDARY_RECEIPT ' + JSON.stringify(sourceBoundary));
run('strict-experiment-compile', [compiler, '--project', relative(path.join(directory, 'tsconfig.json')), '--pretty', 'false']);
const namespace = await import(pathToFileURL(path.join(directory, 'dist/index.js')).href);
assert.deepEqual(Object.keys(namespace).sort(), ['createF2MeshProfilePlan', 'createF2MeshSourcePlan'], 'F2_COMPILED_ENTRY_EXACT');
assert.equal(typeof namespace.createF2MeshSourcePlan, 'function', 'F2_COMPILED_FACTORY_REQUIRED');
assert.equal(typeof namespace.createF2MeshProfilePlan, 'function', 'F2_COMPILED_PROFILE_FACTORY_REQUIRED');
const testDirectory = path.join(directory, 'test');
const tests = fs.readdirSync(testDirectory, { withFileTypes: true })
  .filter(item => item.isFile() && item.name.endsWith('.test.mjs'))
  .map(item => relative(path.join(testDirectory, item.name))).sort();
assert(tests.length > 0, 'F2_EXPERIMENT_TEST_FILES_REQUIRED');
console.log('F2_EXPERIMENT_TEST_SCOPE ' + JSON.stringify(tests));
run('ordinary-experiment-tests', ['--test', ...tests]);
run('strict-positive-types', [compiler, '--project', relative(path.join(directory, 'type-tests/tsconfig.positive.json')), '--pretty', 'false']);
const negativeText = fs.readFileSync(path.join(directory, 'type-tests/negative.ts'), 'utf8');
assert(!/@ts-(?:expect-error|ignore|nocheck)\b/.test(negativeText), 'F2_TYPES_UNSUPPRESSED_NEGATIVE_REQUIRED');
const negative = run('unsuppressed-negative-types', [compiler, '--project',
  relative(path.join(directory, 'type-tests/tsconfig.negative.json')), '--pretty', 'false'], 1);
assert.equal(negative.stderr, '', 'F2_TYPES_UNEXPECTED_COMPILER_STDERR');
const observed = diagnostics(negative.stdout);
assert.deepEqual(observed, expected, 'F2_TYPES_COMPLETE_DIAGNOSTIC_TUPLES');
console.log('F2_TYPE_DIAGNOSTIC_RECEIPT ' + JSON.stringify({ positiveDiagnostics: 0, diagnostics: observed }));
// Profile consumer types remain separate from the retained A declaration lane.
const profileNegativeFile = 'knowledge-base/experiments/spine-f2/type-tests/profile-negative.ts';
const profileExpected = expectations(path.join(directory, 'type-tests/profile-negative-expectations.json'), profileNegativeFile);
typeConfiguration('profile-positive', true);
typeConfiguration('profile-negative', true);
run('strict-profile-positive-types', [compiler, '--project', relative(path.join(directory, 'type-tests/tsconfig.profile-positive.json')), '--pretty', 'false']);
const profileNegativeText = fs.readFileSync(path.join(root, profileNegativeFile), 'utf8');
assert(!/@ts-(?:expect-error|ignore|nocheck)\b/.test(profileNegativeText), 'F2_PROFILE_TYPES_UNSUPPRESSED_NEGATIVE_REQUIRED');
const profileNegative = run('unsuppressed-profile-negative-types', [compiler, '--project',
  relative(path.join(directory, 'type-tests/tsconfig.profile-negative.json')), '--pretty', 'false'], 1);
assert.equal(profileNegative.stderr, '', 'F2_PROFILE_TYPES_UNEXPECTED_COMPILER_STDERR');
const profileObserved = diagnostics(profileNegative.stdout, profileNegativeFile);
assert.deepEqual(profileObserved, profileExpected, 'F2_PROFILE_TYPES_COMPLETE_DIAGNOSTIC_TUPLES');
console.log('F2_PROFILE_TYPE_DIAGNOSTIC_RECEIPT ' + JSON.stringify({ positiveDiagnostics: 0, diagnostics: profileObserved }));
console.log('F2-A/B development source, strict compilation, experiment tests and both consumer type lanes PASS.');
