// SPDX-License-Identifier: Apache-2.0
// EVIDENCE: replays of the strict type tools that record product bytes, each around one assigned
// refusal. They hold only for the product files those tools were written against; see
// tools/lib/evidence-lane.mjs. They were part of tests/project-boundaries.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,symlinkSync,rmSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {ownerRelativePath} from '../tools/lib/file-identity.mjs';
import {selectM13StrictSuccessor} from '../tools/lib/m13-strict-successor.mjs';
import {repository,run,isolated,prepareTypeFixture} from './helpers/project-fixture.mjs';

// Each identity refusal follows a fresh complete sequence compiler baseline.
for(const [label,file]of [
 ['implementation','packages/runtime/src/DisplayObject.ts'],
 ['declaration','packages/runtime/dist/DisplayObject.d.ts'],
])test('sequence source successor rejects an unregistered '+label+' after its genuine baseline',()=>isolated(fixture=>{
 prepareTypeFixture(fixture);
 const baseline=run(['tools/sequence-playback-types.mjs'],fixture.root);
 assert.ifError(baseline.error);assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
 assert.match(baseline.stdout,/Sequence playback positive live exact diagnostics/);
 assert.match(baseline.stdout,/Sequence playback negative live exact diagnostics/);
 assert.match(baseline.stdout,/Sequence playback import-negative live exact diagnostics/);
 assert.match(baseline.stdout,/Sequence playback types PASS/);
 const original=readFileSync(path.join(fixture.root,file));
 fixture.write(file,original.toString('utf8')+'\n// unregistered source identity\n');
 const refused=run(['tools/sequence-playback-types.mjs'],fixture.root);
 assert.ifError(refused.error);assert.equal(refused.status,1,refused.stdout+refused.stderr);
 assert.ok(refused.stderr.includes('source/config/compiler identity changed: '+file));
 assert.doesNotMatch(refused.stdout,/Sequence playback types PASS/);
}));

// M1.3 finite compiler successor controls use the complete owned fixture.
for (const [label, file, suffix, reason] of [
  ['new declaration', 'packages/contracts/dist/SharedMaterial2D.d.ts', '\n// unregistered shared declaration\n',
    'source/config/compiler identity changed: packages/contracts/dist/SharedMaterial2D.d.ts'],
  ['source-only split', 'packages/runtime/src/sharedFrameCapture.ts', '\n// unregistered shared source\n',
    'source/config/compiler identity changed: packages/runtime/src/sharedFrameCapture.ts'],
  ['observation data', 'tools/m13-strict-successors.json', '\n', 'changed successor data'],
]) test('M1.3 strict successor rejects ' + label + ' between genuine complete baselines', () => isolated(fixture => {
  prepareTypeFixture(fixture);
  const healthy = result => {
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const lane of ['positive', 'negative', 'import-negative'])
      assert.ok(result.stdout.includes('Sequence playback ' + lane + ' live exact diagnostics'), result.stdout);
    assert.match(result.stdout, /Sequence playback types PASS/);
  };
  healthy(run(['tools/sequence-playback-types.mjs'], fixture.root));
  const original = readFileSync(path.join(fixture.root, file));
  let refused;
  try {
    fixture.write(file, original.toString('utf8') + suffix);
    refused = run(['tools/sequence-playback-types.mjs'], fixture.root);
  } finally {
    fixture.write(file, original.toString('utf8'));
    assert.deepEqual(readFileSync(path.join(fixture.root, file)), original);
  }
  // Restoration is proved even when a later refusal assertion detects a regression.
  healthy(run(['tools/sequence-playback-types.mjs'], fixture.root));
  assert.ifError(refused.error);
  assert.equal(refused.signal, null);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.ok(refused.stderr.includes(reason), refused.stderr);
  assert.doesNotMatch(refused.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError/);
  assert.doesNotMatch(refused.stdout, /Sequence playback types PASS/);
}));

// M1.5 additions preserve the historical M1.3 refusal controls above.
for (const [label, file, suffix, reason] of [
  ['observation data', 'tools/m15-strict-successors.json', '\n', 'changed successor data'],
  ['UI managed source', 'packages/runtime/src/DisplayObject.ts', '\n// unregistered UI managed source\n',
    'source/config/compiler identity changed: packages/runtime/src/DisplayObject.ts'],
  ['UI tree declaration', 'packages/runtime/dist/displayTreeState.d.ts', '\n// unregistered UI tree declaration\n',
    'source/config/compiler identity changed: packages/runtime/dist/displayTreeState.d.ts'],
  ['content plan declaration', 'packages/contracts/dist/ResourceManifest.d.ts', '\n// unregistered content plan declaration\n',
    'source/config/compiler identity changed: packages/contracts/dist/ResourceManifest.d.ts'],
  ['content tool lock', 'pnpm-lock.yaml', '\n', 'source/config/compiler identity changed: pnpm-lock.yaml'],
  ['manifest declaration', 'packages/engine/dist/manifestResourceTypes.d.ts', '\n// unregistered manifest declaration\n',
    'source/config/compiler identity changed: packages/engine/dist/manifestResourceTypes.d.ts'],
]) test('M1.5 strict successor rejects ' + label + ' between genuine complete baselines', () => isolated(fixture => {
  prepareTypeFixture(fixture);
  const healthy = result => {
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const lane of ['positive', 'negative', 'import-negative'])
      assert.ok(result.stdout.includes('Sequence playback ' + lane + ' live exact diagnostics'), result.stdout);
    assert.match(result.stdout, /Sequence playback types PASS/);
  };
  healthy(run(['tools/sequence-playback-types.mjs'], fixture.root));
  const original = readFileSync(path.join(fixture.root, file));
  let refused;
  try {
    fixture.write(file, original.toString('utf8') + suffix);
    refused = run(['tools/sequence-playback-types.mjs'], fixture.root);
  } finally {
    fixture.write(file, original.toString('utf8'));
    assert.deepEqual(readFileSync(path.join(fixture.root, file)), original);
  }
  // Restoration is proved even when a later refusal assertion detects a regression.
  healthy(run(['tools/sequence-playback-types.mjs'], fixture.root));
  assert.ifError(refused.error);
  assert.equal(refused.signal, null);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.ok(refused.stderr.includes(reason), refused.stderr);
  assert.doesNotMatch(refused.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError/);
  assert.doesNotMatch(refused.stdout, /Sequence playback types PASS/);
}));

// M1.3 finite compiler successor controls use the complete owned fixture.
const m13Healthy = (owner, result) => {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /strict public consumers PASS/);
  const lanes = owner === 'atlas-import' ? ['positive', 'negative', 'import-negative'] : ['positive', 'negative'];
  for (const lane of lanes) assert.ok(result.stdout.includes(lane), result.stdout);
};
test('M1.3 Atlas successor still authenticates the exact historical lib/lib.d.ts', () => isolated(fixture => {
  prepareTypeFixture(fixture);
  const gate = 'tools/atlas-import-types.mjs';
  m13Healthy('atlas-import', run([gate], fixture.root));
  const relative = 'node_modules/@typescript/typescript-' + process.platform + '-' + process.arch + '/lib/lib.d.ts';
  const absolute = path.join(fixture.root, relative), original = readFileSync(absolute);
  assert.equal(ownerRelativePath(realpathSync(fixture.root), realpathSync(absolute)), relative);
  let refused;
  try {
    rmSync(absolute);
    refused = run([gate], fixture.root);
  } finally { writeFileSync(absolute, original); }
  assert.deepEqual(readFileSync(absolute), original);
  m13Healthy('atlas-import', run([gate], fixture.root));
  assert.ifError(refused.error);
  assert.equal(refused.signal, null);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /File spelling differs from its portable identity: .*lib\/lib\.d\.ts/);
  assert.doesNotMatch(refused.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError/);
}));
test('M1.3 strict successor rejects a byte-identical foreign SDK alias owner', () => isolated(fixture => {
  prepareTypeFixture(fixture);
  const gate = 'tools/bitmap-resource-slot-types.mjs';
  const real = path.join(fixture.root, 'packages/runtime'), foreign = path.join(fixture.root, 'foreign-runtime');
  const alias = path.join(fixture.root, 'node_modules/@egret/runtime');
  cpSync(real, foreign, {recursive:true});
  assert.deepEqual(readFileSync(path.join(real,'dist/index.d.ts')),readFileSync(path.join(foreign,'dist/index.d.ts')));
  m13Healthy('bitmap-resource-slot', run([gate], fixture.root));
  let refused;
  try {
    assert.equal(ownerRelativePath(realpathSync(fixture.root),realpathSync(alias)),'packages/runtime');
    rmSync(alias,{recursive:true,force:false});
    symlinkSync(foreign,alias,'junction');
    refused = run([gate], fixture.root);
  } finally {
    if (existsSync(alias)) {
      assert.equal(ownerRelativePath(realpathSync(fixture.root),realpathSync(alias)),'foreign-runtime');
      rmSync(alias,{recursive:true,force:false});
    }
    symlinkSync(real,alias,'junction');
  }
  assert.equal(ownerRelativePath(realpathSync(fixture.root),realpathSync(alias)),'packages/runtime');
  m13Healthy('bitmap-resource-slot', run([gate], fixture.root));
  assert.ifError(refused.error);
  assert.equal(refused.signal, null);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, /foreign SDK alias runtime/);
  assert.doesNotMatch(refused.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError/);
}));
for (const owner of ['bitmap-resource-slot','linear-layout']) {
  test('M1.3 ' + owner + ' keeps its historical self row immutable', () => isolated(fixture => {
    prepareTypeFixture(fixture);
    const gate = 'tools/' + owner + '-types.mjs';
    const file = 'tests/types/' + owner + '-diagnostic-expectations.json';
    const original = readFileSync(path.join(fixture.root,file));
    m13Healthy(owner, run([gate], fixture.root));
    const inventory = JSON.parse(original), row = inventory.inputPins.find(row=>row.path===gate);
    assert.ok(row);
    row.bytes++;
    let refused;
    try {
      fixture.write(file,JSON.stringify(inventory,null,2)+'\n');
      refused = run([gate],fixture.root);
    } finally { fixture.write(file,original.toString('utf8')); }
    assert.deepEqual(readFileSync(path.join(fixture.root,file)),original);
    m13Healthy(owner,run([gate],fixture.root));
    assert.ifError(refused.error);
    assert.equal(refused.signal,null);
    assert.equal(refused.status,1,refused.stdout+refused.stderr);
    assert.match(refused.stderr,/historical inventory changed/);
    assert.doesNotMatch(refused.stderr,/ERR_MODULE_NOT_FOUND|SyntaxError/);
  }));
  test('M1.3 ' + owner + ' rejects gate-byte drift across its actual compiler replay checkpoint', () => isolated(fixture => {
    prepareTypeFixture(fixture);
    const gate = 'tools/' + owner + '-types.mjs';
    const inventory = JSON.parse(readFileSync(path.join(fixture.root,'tests/types/'+owner+'-diagnostic-expectations.json'),'utf8'));
    const selected = selectM13StrictSuccessor(fixture.root,owner,inventory);
    assert.ok(selected);
    // The selected owner spans an actual complete compiler run; then a single
    // gate file changes before its next metadata checkpoint. This is a source
    // admission witness, not a timed concurrent-process race claim.
    m13Healthy(owner,run([gate],fixture.root));
    const original = readFileSync(path.join(fixture.root,gate));
    let caught;
    try {
      fixture.write(gate,original.toString('utf8')+'\n// gate changed after selection\n');
      try { selected.recheck(); } catch (error) { caught=error; }
    } finally { fixture.write(gate,original.toString('utf8')); }
    assert.deepEqual(readFileSync(path.join(fixture.root,gate)),original);
    selected.recheck();
    m13Healthy(owner,run([gate],fixture.root));
    assert.ok(caught instanceof Error);
    assert.ok(caught.message.includes('source/config/compiler identity changed: '+gate),caught?.message);
  }));
}

// A complete current consumer baseline precedes each exact package drift.
for (const [label, change] of [
 ['extra export', value=>{value.exports['./unreviewed']='./dist/index.js';}],
 ['changed UI target', value=>{value.exports['./ui'].import='./dist/index.js';}],
 ['changed WebGL2 target', value=>{value.exports['./webgl2'].import='./dist/index.js';}],
 ['changed dependency', value=>{value.dependencies['robust-predicates']='3.0.4';}],
]) test('M1.4 strict package successor refuses '+label+' after a complete baseline',()=>isolated(fixture=>{
 prepareTypeFixture(fixture);
 const args=['tools/display-container-remove-children-types.mjs'];
 const healthy=()=>{const r=run(args,fixture.root);assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,0,r.stdout+r.stderr);};
 healthy();
 const file='packages/engine/package.json',raw=readFileSync(path.join(fixture.root,file));
 const value=JSON.parse(raw);change(value);
 let rejected;
 try {fixture.write(file,JSON.stringify(value,null,2)+'\n');rejected=run(args,fixture.root);}
 finally {fixture.write(file,raw.toString('utf8'));assert.deepEqual(readFileSync(path.join(fixture.root,file)),raw);}
 healthy();
 assert.ifError(rejected.error);assert.equal(rejected.signal,null);assert.equal(rejected.status,1,rejected.stdout+rejected.stderr);
 assert.match(rejected.stderr,/source\/config\/compiler identity changed: packages\/engine\/package\.json/);
 assert.doesNotMatch(rejected.stderr,/ERR_MODULE_NOT_FOUND|SyntaxError/);
}));

// Preserve the complete five-lane PNG consumer replay around each assigned refusal.
for (const control of [
  { name: 'mixed provider declarations', file: 'packages/engine/dist/web/BrowserTextureProvider.d.ts',
    mutate: raw => raw.toString('utf8') + '// assigned PNG declaration identity drift\n',
    reason: /unregistered or mixed M1\.5 PNG product identity/, compilerStarted: false },
  { name: 'same-count incorrect diagnostic code', file: 'tests/types/browser-png-diagnostic-expectations.json',
    mutate: raw => {
      const value = JSON.parse(raw), group = value.lanes.find(row => row.lane === 'negative');
      assert.ok(group.diagnostics.length > 1); assert.notEqual(group.diagnostics[0].code, 9999);
      group.diagnostics[0].code = 9999; return JSON.stringify(value, null, 2) + '\n';
    }, reason: /changed\/missing\/extra\/duplicate complete diagnostics in negative/, compilerStarted: true },
]) test('M1.5 PNG strict successor rejects ' + control.name + ' between genuine complete baselines', () => isolated(fixture => {
  prepareTypeFixture(fixture);
  for (const relative of ['tools/browser-png-types.mjs', 'tsconfig.json']) {
    fixture.write(relative, readFileSync(path.join(repository, relative), 'utf8'));
  }
  const args = ['tools/browser-png-types.mjs'];
  const healthy = () => {
    const result = run(args, fixture.root);
    assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, '');
    const lanes = [...result.stdout.matchAll(/^Browser PNG ([-a-z]+) exact diagnostic replay: /gm)].map(row => row[1]);
    assert.deepEqual(lanes, ['positive', 'negative', 'import-negative', 'dom-free-positive', 'dom-free-negative']);
    assert.match(result.stdout, /Browser PNG strict consumers PASS; runtime, policy and native acceptance are separate\./);
  };
  healthy();
  const raw = readFileSync(path.join(fixture.root, control.file)); let refused;
  try { fixture.write(control.file, control.mutate(raw)); refused = run(args, fixture.root); }
  finally { fixture.write(control.file, raw.toString('utf8')); assert.deepEqual(readFileSync(path.join(fixture.root, control.file)), raw); healthy(); }
  assert.ifError(refused.error); assert.equal(refused.signal, null); assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.match(refused.stderr, control.reason); assert.doesNotMatch(refused.stderr, /ERR_MODULE_NOT_FOUND|SyntaxError/);
  if (control.compilerStarted) assert.match(refused.stdout, /^Browser PNG positive exact diagnostic replay: \[\]$/m);
  else assert.equal(refused.stdout, '');
  assert.doesNotMatch(refused.stdout, /Browser PNG strict consumers PASS/);
}));
