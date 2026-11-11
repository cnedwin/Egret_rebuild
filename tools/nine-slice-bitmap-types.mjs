// SPDX-License-Identifier: Apache-2.0
// Re-run the actual strict-consumer tuples; renderer and resource behavior are separate.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath } from './lib/file-identity.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
if (process.argv.length !== 2) throw new TypeError('This type gate accepts no arguments');
const inventory = JSON.parse(readFileSync(path.join(root, 'tests/types/nine-slice-bitmap-diagnostic-expectations.json'), 'utf8'));
// Preserve the immutable predecessor and authenticate the complete M1.3 successor.
const m13HelperPin = fingerprintFile(root, 'tools/lib/m13-strict-successor.mjs');
if ((m13HelperPin.bytes !== 85316 || m13HelperPin.sha256 !== '8d9d3604ca43eefd1d13b63c24023a1bb7347e8248e9b4b7756e00205054ee93') && (m13HelperPin.bytes !== 85991 || m13HelperPin.sha256 !== 'c160e1d8cd83e131cac6f73953412e83e3331c320d3842e3af2913b99a2bd290') && (m13HelperPin.bytes !== 88195 || m13HelperPin.sha256 !== 'c71a650058f5995c9ac0c40b4087fad09c0241f5a6c6f35c5c56ee524ac21bf6') && (m13HelperPin.bytes !== 89966 || m13HelperPin.sha256 !== '11f2455aa5f3a9b1aaa5f27692a39448452cba2bfefb10695cc469e9187a824f') && (m13HelperPin.bytes !== 91887 || m13HelperPin.sha256 !== 'c97e18f56974923679ea61b6ffad764bd5b064dea3f29e8e81122ce1f4666f08') && (m13HelperPin.bytes !== 93794 || m13HelperPin.sha256 !== '34f0b589b334c95380f61ff73a01e4ddf50ba52d5a08864320e8f461cca92071') && (m13HelperPin.bytes !== 94148 || m13HelperPin.sha256 !== '5483519fc7a3ae81d58978c675eb75da1669ab12ed8f2f5961cb5d33773c91f7')) throw Error('M1.3 strict helper changed before import');
const { selectM13StrictSuccessor } = await import('./lib/m13-strict-successor.mjs');
const m13 = selectM13StrictSuccessor(root, 'nine-slice-bitmap', inventory);

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw Error('NineSliceBitmap types: ' + message); };
const lanes = ['positive','negative','import-negative'];
const expectedInputs = [
  'node_modules/typescript/package.json','node_modules/typescript/bin/tsc',
  'node_modules/typescript/lib/tsc.js','node_modules/typescript/lib/getExePath.js',
  'pnpm-lock.yaml','tsconfig.base.json','tests/types/tsconfig.json','tests/types/tsconfig.dom-free.json','tests/types/tsconfig.web.json',
  ...lanes.flatMap(lane => ['tests/types/nine-slice-bitmap-' + lane + '.ts','tests/types/tsconfig.nine-slice-bitmap-' + lane + '.json']),
  'packages/runtime/dist/NineSliceBitmap.d.ts','packages/runtime/dist/index.d.ts','packages/engine/dist/index.d.ts',
];
if (inventory.schemaVersion !== 1 || inventory.kind !== 'NINE_SLICE_BITMAP_ACTUAL_STRICT_DIAGNOSTICS'
  || inventory.status !== 'OBSERVED_FROZEN_TS7_DIAGNOSTICS'
  || !equal(inventory.tupleFormat, ['file','line','column','code','message'])) fail('actual observations are pending or malformed');
if (!equal(inventory.inputPins?.map(pin => pin.path), expectedInputs)) fail('incomplete compiler/configuration/consumer/declaration inputs');
for (const pin of m13?.inputPins ?? inventory.inputPins) {
  if (logicalPath(pin.path) !== pin.path || !equal(fingerprintFile(root, pin.path), pin)) fail('changed raw input: ' + pin.path);
}
if (JSON.parse(readFileSync(path.join(root, 'node_modules/typescript/package.json'), 'utf8')).version !== '7.0.2') fail('compiler version changed');
for (const name of ['contracts','runtime','engine','project']) {
  if (!samePhysicalPath(realpathSync(path.join(root,'node_modules/@egret',name)), realpathSync(path.join(root,'packages',name)), process.platform)) fail('foreign workspace alias: ' + name);
}
if (!Array.isArray(inventory.groups) || !equal(inventory.groups.map(group => group.lane), lanes)) fail('incomplete consumer lanes');
for (const group of inventory.groups) {
  m13?.recheck();
  if (group.expectedExit !== (group.lane === 'positive' ? 0 : 1)) fail('wrong required lane exit');
  if (!Array.isArray(group.cases) || !Array.isArray(group.tuples)
    || group.tuples.some(tuple => !Array.isArray(tuple) || tuple.length !== 5
      || typeof tuple[0] !== 'string' || ![tuple[1],tuple[2],tuple[3]].every(value => Number.isSafeInteger(value) && value > 0)
      || typeof tuple[4] !== 'string' || !tuple[4])) fail('malformed frozen cases or complete tuples');
  const original = group.observedExecution;
  if (!original || original.exitCode !== group.expectedExit || original.timeout !== false
    || ['stdout','stderr'].some(name => !original[name] || !Number.isSafeInteger(original[name].bytes)
      || original[name].bytes < 0 || !/^[0-9a-f]{64}$/.test(original[name].sha256))
    || original.stderr.bytes !== 0) fail('original compiler observation is missing');
  const file = 'tests/types/nine-slice-bitmap-' + group.lane + '.ts';
  const config = 'tests/types/tsconfig.nine-slice-bitmap-' + group.lane + '.json';
  const text = readFileSync(path.join(root,file),'utf8');
  if (/@ts-(?:expect-error|ignore|nocheck)\b/.test(text)) fail('suppressed diagnostic');
  const cases = text.split('\n').flatMap((line,index) => {
    const match = /^\/\/ NLB_TYPE_CASE (NLB-[NI]\d{2}): (.+)$/.exec(line);
    return match ? [{name:match[1],line:index+2}] : [];
  });
  const expectedNames = group.lane === 'positive' ? [] : Array.from({length:group.lane === 'negative' ? 17 : 8},
    (_,index) => 'NLB-' + (group.lane === 'negative' ? 'N' : 'I') + String(index+1).padStart(2,'0'));
  if (!equal(cases.map(row=>row.name),expectedNames) || !equal(cases, group.cases)
    || new Set(cases.map(row=>row.name)).size !== cases.length) fail('source intent inventory changed');
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc','--project',config,'--pretty','false'], {
    cwd:root, encoding:'utf8', timeout:60000, maxBuffer:4*1024*1024,
  });
  if (result.error || result.signal !== null || result.status !== group.expectedExit || result.stderr !== '') fail('compiler setup/exit/stderr failure');
  const tuples = [];
  for (const line of result.stdout.replaceAll('\r\n','\n').split('\n')) {
    if (line === '') continue;
    const match = /^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if (match) {
      const absolute = path.isAbsolute(match[1]) ? match[1] : path.resolve(root,match[1]);
      tuples.push([ownerRelativePath(root,absolute,process.platform),Number(match[2]),Number(match[3]),Number(match[4]),match[5]]);
    } else if (/^ {2,}\S/.test(line) && tuples.length) tuples.at(-1)[4] += '\n' + line;
    else fail('unlocated or unconsumed compiler output');
  }
  if (tuples.some(tuple=>tuple[0]!==file || tuple[3]===2307 || /[A-Za-z]:[\\/]|file:\/\//.test(tuple[4]))
    || !equal(tuples,m13?.group(group.lane).tuples ?? group.tuples) || tuples.length!==cases.length
    || !equal(tuples.map(tuple=>tuple[1]),cases.map(row=>row.line))) fail('missing, extra, unrelated or changed complete diagnostic');
  m13?.verifyClosure(group.lane);
  console.log('NineSliceBitmap ' + group.lane + ' exact strict diagnostics: ' + JSON.stringify(tuples));
}
console.log('NineSliceBitmap strict public consumers PASS; runtime/browser acceptance remains separate.');
