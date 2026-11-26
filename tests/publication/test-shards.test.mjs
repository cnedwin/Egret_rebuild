// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseShard, selectShard } from '../../tools/lib/test-shards.mjs';

const read = relative => readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');

test('TS01 a shard is an exact index within a bounded count', () => {
  assert.deepEqual(parseShard('1/4'), { index: 1, count: 4 });
  assert.deepEqual(parseShard('16/16'), { index: 16, count: 16 });
  for (const text of [
    '',
    '0/4',
    '5/4',
    '1/0',
    '1/17',
    '01/4',
    '1/4 ',
    ' 1/4',
    '1-4',
    '1/4/2',
    '-1/4',
    '1.0/4',
    undefined,
    1
  ]) {
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
  for (const [index, count] of [
    [0, 2],
    [3, 2],
    [1, 0],
    [1.5, 2],
    [1, 2.5]
  ])
    assert.throws(() => selectShard(['a'], index, count), RangeError);
});

test('TS04 the workflow runs every shard of the count it names and requires them all', () => {
  const workflow = read('.github/workflows/ci.yml');
  const matrix = /\n  windows-tests:\n[\s\S]*?\n        shard: \[([0-9, ]+)\]\n/.exec(workflow);
  assert.ok(matrix, 'The test shard matrix is declared');
  const shards = matrix[1].split(',').map(text => Number(text.trim()));
  const commands = [...workflow.matchAll(/node tools\/test\.mjs --shard=\$\{\{ matrix\.shard \}\}\/([0-9]+)\n/g)];
  assert.equal(commands.length, 1);
  const count = Number(commands[0][1]);
  assert.deepEqual(
    shards,
    Array.from({ length: count }, (_, index) => index + 1)
  );
  assert.ok(workflow.includes('      fail-fast: false\n      matrix:\n        shard: ['));
  // The job without test files and the shards are both required by the final check.
  assert.equal(workflow.split('node tools/prepush.mjs --integrated --no-tests\n').length, 2);
  assert.ok(workflow.includes('    needs: [retained, route, prepare-windows-toolchain, windows, windows-tests, cpu]\n'));
  assert.ok(
    workflow.includes(
      '              test "$ROUTE_PROFILE" = full\n              test "$WINDOWS_TESTS_RESULT" = success\n'
    )
  );
});

test('TS05 the slow list of the runner names existing files once', () => {
  const runner = read('tools/test.mjs'),
    list = /\nconst slow = (\[[^\]]*\]);\n/.exec(runner);
  assert.ok(list, 'The slow list is one literal');
  const slow = JSON.parse(list[1]);
  assert.equal(new Set(slow).size, slow.length);
  const tests = new Set(readdirSync(new URL('../', import.meta.url)).map(name => 'tests/' + name));
  for (const file of slow) assert.ok(tests.has(file), file);
});

test('TS06 the browser PNG controls are dealt to exactly four files', () => {
  const owner = read('tests/browser-png-boundaries.test.mjs');
  assert.ok(
    owner.includes("const parts = 4, part = Number(new URL(import.meta.url).searchParams.get('part') ?? '1');")
  );
  const siblings = readdirSync(new URL('../', import.meta.url))
    .filter(name => /^browser-png-boundaries-[0-9]+\.test\.mjs$/.test(name))
    .sort();
  assert.deepEqual(
    siblings,
    [2, 3, 4].map(part => 'browser-png-boundaries-' + part + '.test.mjs')
  );
  for (const part of [2, 3, 4]) {
    const lines = read('tests/browser-png-boundaries-' + part + '.test.mjs')
      .split('\n')
      .filter(line => line && !line.startsWith('//'));
    assert.deepEqual(lines, ["import './browser-png-boundaries.test.mjs?part=" + part + "';"]);
  }
});

test('TS07 every Windows job consumes the single verified toolchain without weakening the gate', () => {
  const workflow = read('.github/workflows/ci.yml');
  const job = name => {
    const start = workflow.indexOf('\n  ' + name + ':\n');
    assert.notEqual(start, -1, name);
    const next = workflow.slice(start + 3).search(/\n  [a-z-]+:\n/);
    return workflow.slice(start, next < 0 ? undefined : start + 3 + next);
  };
  const prepare = job('prepare-windows-toolchain'),
    merge = job('merge-ready');
  assert.ok(prepare.includes('needs: [route]'));
  assert.ok(prepare.includes('node tools/windows-pwsh.mjs prepare'));
  assert.ok(prepare.includes('actions/cache/restore@'));
  assert.ok(prepare.includes('actions/cache/save@'));
  assert.ok(prepare.includes("github.event_name == 'push' && github.ref == 'refs/heads/main'"));
  assert.ok(prepare.includes('actions/upload-artifact@'));
  assert.ok(prepare.includes('overwrite: true'));
  assert.ok(!workflow.includes('restore-keys:'));
  const cacheKeys = [...workflow.matchAll(/^          key: (egret-pwsh-windows-x64-.+)$/gm)].map(match => match[1]);
  assert.equal(cacheKeys.length, 4);
  assert.deepEqual([...new Set(cacheKeys)], ["egret-pwsh-windows-x64-${{ hashFiles('tools/windows-pwsh-lock.json') }}"]);
  const artifactNames = [...workflow.matchAll(/^          name: (egret-pwsh-windows-x64-.+)$/gm)].map(match => match[1]);
  assert.equal(artifactNames.length, 3);
  assert.equal(new Set(artifactNames).size, 1);
  assert.equal(workflow.split('EGRET_PWSH_MIRROR_URL: ${{ vars.EGRET_PWSH_MIRROR_URL }}').length - 1, 3);
  // Only the transfer actions may continue after a failure; the helper always checks the content.
  for (const step of workflow.split(/\n      - /).filter(step => step.includes('continue-on-error: true'))) {
    assert.match(step, /uses: actions\/(?:cache\/(?:restore|save)|(?:upload|download)-artifact)@[0-9a-f]{40}/);
    assert.doesNotMatch(step, /run: node tools\/windows-pwsh\.mjs/);
  }
  for (const name of ['windows', 'windows-tests']) {
    const worker = job(name);
    assert.ok(worker.includes('needs: [route, prepare-windows-toolchain]'));
    assert.ok(worker.includes('node tools/windows-pwsh.mjs probe'));
    assert.ok(worker.includes('actions/download-artifact@'));
    assert.ok(worker.includes('node tools/windows-pwsh.mjs prepare'));
    assert.ok(worker.includes('node tools/windows-pwsh.mjs install'));
    assert.ok(worker.includes("if: steps.pwsh-probe.outputs.ready != 'true'"));
    assert.ok(worker.includes("if: steps.pwsh-artifact.outcome == 'failure'"));
    assert.match(worker, /- name: Install and validate exact PowerShell\n        shell: pwsh\n        run: node tools\/windows-pwsh\.mjs install\n/);
    assert.ok(worker.indexOf('node tools/windows-pwsh.mjs install') < worker.indexOf('pnpm setup:dev --no-build'));
    assert.ok(!worker.includes('Invoke-WebRequest'));
    assert.ok(!worker.includes('actions/cache/save@'));
  }
  assert.equal(workflow.split('node tools/windows-pwsh.mjs install').length - 1, 2);
  assert.ok(merge.includes('test "$WINDOWS_TOOLCHAIN_RESULT" = skipped'));
  assert.ok(merge.includes('test "$WINDOWS_TOOLCHAIN_RESULT" = success'));
  assert.ok(merge.includes('test "$WINDOWS_TESTS_RESULT" = skipped'));
});
