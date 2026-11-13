// SPDX-License-Identifier: Apache-2.0
// UNIT: the evidence lane. Its checks are left out of the merge sequence and of the test suite,
// and its report describes them without ever refusing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_TOOLS, EVIDENCE_TESTS } from '../tools/lib/evidence-lane.mjs';
import { firstReason, runEvidenceTool, runEvidenceTest } from '../tools/evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const node = (args, cwd = root) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
const lines = text => text.replaceAll('\r\n', '\n').split('\n').filter(Boolean);

test('EL01 the lane names existing tools and test files, each once, and cannot be changed in place', () => {
  for (const list of [EVIDENCE_TOOLS, EVIDENCE_TESTS]) {
    assert.ok(Object.isFrozen(list) && list.length > 0);
    assert.equal(new Set(list).size, list.length);
  }
  for (const tool of EVIDENCE_TOOLS) assert.ok(fs.existsSync(path.join(root, 'tools', tool + '.mjs')), tool);
  for (const file of EVIDENCE_TESTS) { assert.match(file, /^tests\/(?:publication\/)?[a-z0-9-]+\.test\.mjs$/); assert.ok(fs.existsSync(path.join(root, file)), file); }
});

test('EL02 the merge sequence runs no evidence tool and compiles the type lanes before the retained type checks', () => {
  const source = fs.readFileSync(path.join(root, 'tools/verify.mjs'), 'utf8'), literal = /\nconst gates = \[([^\n]*)\];\n/.exec(source);
  assert.ok(literal, 'The sequence is one literal');
  const gates = [...literal[1].matchAll(/"([a-z0-9/-]+)"/g)].map(match => match[1]);
  for (const gate of gates) assert.equal(EVIDENCE_TOOLS.includes(gate), false, gate);
  for (const gate of ['build', 'check-boundaries', 'check-type-lanes', 'check-types', 'test']) assert.ok(gates.includes(gate), gate);
  assert.ok(gates.indexOf('check-type-lanes') < gates.indexOf('check-types'));
  // The sequence itself refuses a list that names an evidence tool.
  assert.ok(source.includes('if (gates.some(script => EVIDENCE_TOOLS.includes(script))) throw new Error("An evidence tool cannot be a merge gate");'));
  // The retained type checks no longer replay any evidence tool.
  const types = fs.readFileSync(path.join(root, 'tools/check-types.mjs'), 'utf8');
  for (const tool of EVIDENCE_TOOLS) assert.equal(types.includes("'./" + tool + ".mjs'"), false, tool);
});

test('EL03 the suite and the lane together hold every top-level test file exactly once', () => {
  const listed = node(['tools/test.mjs', '--list']);
  assert.equal(listed.status, 0, listed.stderr);
  const suite = lines(listed.stdout), top = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.mjs')).map(name => 'tests/' + name);
  assert.equal(new Set(suite).size, suite.length);
  for (const file of EVIDENCE_TESTS) assert.equal(suite.includes(file), false, file);
  assert.deepEqual([...suite.filter(file => file.startsWith('tests/')), ...EVIDENCE_TESTS.filter(file => !file.startsWith('tests/publication/'))].sort(), top.sort());
  // A publication file of the lane is not among the publication files the push entry runs.
  const push = fs.readFileSync(path.join(root, 'tools/prepush.mjs'), 'utf8');
  for (const file of EVIDENCE_TESTS) assert.equal(push.includes("'" + file + "'"), false, file);
  // Every shard of one count deals the same suite, still without the lane.
  const dealt = [1, 2, 3, 4].flatMap(index => lines(node(['tools/test.mjs', '--list', '--shard=' + index + '/4']).stdout));
  assert.deepEqual(dealt.sort(), [...suite].sort());
});

test('EL04 a report line gives the first stated reason', () => {
  assert.equal(firstReason('VERIFY x\nError: SS1_BOUNDARY_SOURCE_OWNER: identity differs: a.js\n    at file:///x.mjs:1:1\n\nNode.js v26.7.0\n'), 'Error: SS1_BOUNDARY_SOURCE_OWNER: identity differs: a.js');
  assert.equal(firstReason('AssertionError [ERR_ASSERTION]: changed\n'), 'AssertionError [ERR_ASSERTION]: changed');
  assert.equal(firstReason('{"issues":[{"code":"X"}]}\n'), '{"issues":[{"code":"X"}]}');
  assert.equal(firstReason('one\n\nlast line\n'), 'last line');
  assert.equal(firstReason(''), '');
  assert.equal(firstReason('Error: ' + 'x'.repeat(400)).length, 240);
});

test('EL05 a tool or test file that refuses is reported as stale, and one that completes as holding', () => {
  const owned = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-evidence-')));
  const put = (relative, text) => { fs.mkdirSync(path.dirname(path.join(owned, relative)), { recursive: true }); fs.writeFileSync(path.join(owned, relative), text); };
  try {
    put('tools/holds.mjs', "console.log('PASS');\n");
    put('tools/refuses.mjs', "throw new Error('RECORDED_IDENTITY: differs: packages/x/src/a.ts');\n");
    put('tools/exits.mjs', "console.log('no reason given');process.exit(3);\n");
    put('tests/holds.test.mjs', "import test from 'node:test';test('a',()=>{});test('b',()=>{});\n");
    put('tests/refuses.test.mjs', "import test from 'node:test';test('a',()=>{});test('b',()=>{throw new Error('differs');});test('c',()=>{throw new Error('differs');});\n");
    put('tests/broken.test.mjs', "import './missing.mjs';\n");
    assert.deepEqual(runEvidenceTool(owned, 'holds'), { check: 'tools/holds.mjs', holds: true });
    assert.deepEqual(runEvidenceTool(owned, 'refuses'), { check: 'tools/refuses.mjs', holds: false, reason: 'Error: RECORDED_IDENTITY: differs: packages/x/src/a.ts' });
    assert.deepEqual(runEvidenceTool(owned, 'exits'), { check: 'tools/exits.mjs', holds: false, reason: 'no reason given' });
    assert.equal(runEvidenceTool(owned, 'absent').holds, false);
    assert.deepEqual(runEvidenceTest(owned, 'tests/holds.test.mjs'), { check: 'tests/holds.test.mjs', holds: true, cases: 2 });
    assert.deepEqual(runEvidenceTest(owned, 'tests/refuses.test.mjs'), { check: 'tests/refuses.test.mjs', holds: false, cases: 3, reason: '2 of 3 cases do not hold' });
    assert.equal(runEvidenceTest(owned, 'tests/broken.test.mjs').holds, false);
  } finally { fs.rmSync(owned, { recursive: true, force: true }); }
});

test('EL06 the command lists the lane and refuses options it does not know or cannot combine', () => {
  const listed = node(['tools/evidence.mjs', '--list']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(lines(listed.stdout), [...EVIDENCE_TOOLS.map(tool => 'tools/' + tool + '.mjs'), ...EVIDENCE_TESTS]);
  for (const args of [['--refuse'], ['--list', '--json'], ['--tools', '--tools']]) assert.notEqual(node(['tools/evidence.mjs', ...args]).status, 0, args.join(' '));
});
