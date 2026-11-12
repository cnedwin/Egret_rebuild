// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseShard, selectShard } from '../../tools/lib/test-shards.mjs';

const read = relative => readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

test('TS01 a shard is an exact index within a bounded count', () => {
  assert.deepEqual(parseShard('1/4'), { index: 1, count: 4 });
  assert.deepEqual(parseShard('16/16'), { index: 16, count: 16 });
  for (const text of ['', '0/4', '5/4', '1/0', '1/17', '01/4', '1/4 ', ' 1/4', '1-4', '1/4/2', '-1/4', '1.0/4', undefined, 1]) {
    assert.throws(() => parseShard(text), TypeError, String(text));
  }
});

test('TS02 the shards of one count hold every file exactly once', () => {
  const files = Array.from({ length: 37 }, (_, index) => 'tests/file-' + String(index).padStart(2, '0') + '.test.mjs');
  const slow = [files[30], files[2], 'tests/removed.test.mjs', files[17], files[9], files[36]];
  for (let count = 1; count <= 8; count++) {
    const hands = Array.from({ length: count }, (_, index) => selectShard(files, index + 1, count, slow));
    assert.deepEqual(hands.flat().sort(), files, 'count ' + count);
    assert.equal(new Set(hands.flat()).size, files.length);
    // The listed slow files lead the deal, so they spread over as many hands as there are.
    const present = slow.filter(file => files.includes(file));
    for (const [position, file] of present.entries()) assert.equal(hands[position % count].includes(file), true);
    assert.ok(Math.max(...hands.map(hand => hand.length)) - Math.min(...hands.map(hand => hand.length)) <= 1);
  }
  assert.equal(selectShard(files, 1, 1, slow).length, files.length);
});

test('TS03 malformed lists and positions are refused', () => {
  assert.throws(() => selectShard(['a', 'a'], 1, 2), TypeError);
  assert.throws(() => selectShard(['a', ''], 1, 2), TypeError);
  assert.throws(() => selectShard('a', 1, 2), TypeError);
  assert.throws(() => selectShard(['a'], 1, 2, ['b', 'b']), TypeError);
  for (const [index, count] of [[0, 2], [3, 2], [1, 0], [1.5, 2], [1, 2.5]]) assert.throws(() => selectShard(['a'], index, count), RangeError);
});

test('TS04 the workflow runs every shard of the count it names and requires them all', () => {
  const workflow = read('.github/workflows/ci.yml');
  const matrix = /\n  windows-tests:\n[\s\S]*?\n        shard: \[([0-9, ]+)\]\n/.exec(workflow);
  assert.ok(matrix, 'The test shard matrix is declared');
  const shards = matrix[1].split(',').map(text => Number(text.trim()));
  const commands = [...workflow.matchAll(/node tools\/test\.mjs --shard=\$\{\{ matrix\.shard \}\}\/([0-9]+)\n/g)];
  assert.equal(commands.length, 1);
  const count = Number(commands[0][1]);
  assert.deepEqual(shards, Array.from({ length: count }, (_, index) => index + 1));
  assert.ok(workflow.includes('      fail-fast: false\n      matrix:\n        shard: ['));
  // The job without test files and the shards are both required by the final check.
  assert.equal(workflow.split('node tools/prepush.mjs --integrated --no-tests\n').length, 2);
  assert.ok(workflow.includes('    needs: [retained, route, windows, windows-tests, cpu]\n'));
  assert.ok(workflow.includes('              test "$ROUTE_PROFILE" = full\n              test "$WINDOWS_TESTS_RESULT" = success\n'));
});

test('TS05 the slow list of the runner names existing files once', () => {
  const runner = read('tools/test.mjs'), list = /\nconst slow = (\[[^\]]*\]);\n/.exec(runner);
  assert.ok(list, 'The slow list is one literal');
  const slow = JSON.parse(list[1]);
  assert.equal(new Set(slow).size, slow.length);
  const tests = new Set(readdirSync(new URL('../', import.meta.url)).map(name => 'tests/' + name));
  for (const file of slow) assert.ok(tests.has(file), file);
});

test('TS06 the browser PNG controls are dealt to exactly four files', () => {
  const owner = read('tests/browser-png-boundaries.test.mjs');
  assert.ok(owner.includes("const parts = 4, part = Number(new URL(import.meta.url).searchParams.get('part') ?? '1');"));
  const siblings = readdirSync(new URL('../', import.meta.url)).filter(name => /^browser-png-boundaries-[0-9]+\.test\.mjs$/.test(name)).sort();
  assert.deepEqual(siblings, [2, 3, 4].map(part => 'browser-png-boundaries-' + part + '.test.mjs'));
  for (const part of [2, 3, 4]) {
    const lines = read('tests/browser-png-boundaries-' + part + '.test.mjs').split('\n').filter(line => line && !line.startsWith('//'));
    assert.deepEqual(lines, ["import './browser-png-boundaries.test.mjs?part=" + part + "';"]);
  }
});
