// SPDX-License-Identifier: Apache-2.0
// UNIT: the type lane table and the comparison that decides a lane. A lane names a compiler
// configuration and the lines the compiler prints; it records no file identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TYPE_LANES, compileLane, laneDifference, laneShapeRefusal, readLanes, withoutCheckout } from '../tools/check-type-lanes.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const error = (line, code) => 'tests/types/x-negative.ts(' + line + ',1): error TS' + code + ': Refused.';

test('TL01 a difference names the recorded lines that are gone and the lines that are new, counting repeats', () => {
  const a = error(3, 2345), b = error(5, 2322), c = error(7, 2554);
  assert.deepEqual(laneDifference([a, b], [a, b]), { missing: [], unexpected: [], reordered: false });
  assert.deepEqual(laneDifference([a, b], [a]), { missing: [b], unexpected: [], reordered: false });
  assert.deepEqual(laneDifference([a], [a, c]), { missing: [], unexpected: [c], reordered: false });
  assert.deepEqual(laneDifference([a, b], [a, c]), { missing: [b], unexpected: [c], reordered: false });
  // A line the compiler prints twice is two lines.
  assert.deepEqual(laneDifference([a, a], [a]), { missing: [a], unexpected: [], reordered: false });
  assert.deepEqual(laneDifference([a], [a, a]), { missing: [], unexpected: [a], reordered: false });
  assert.deepEqual(laneDifference([a, b], [b, a]), { missing: [], unexpected: [], reordered: true });
  assert.deepEqual(laneDifference([], []), { missing: [], unexpected: [], reordered: false });
});

test('TL02 a positive lane prints nothing and a negative lane reports an error', () => {
  const positive = 'tests/types/tsconfig.x-positive.json', negative = 'tests/types/tsconfig.x-negative.json';
  assert.equal(laneShapeRefusal(positive, { status: 0, output: [] }), undefined);
  assert.equal(laneShapeRefusal(negative, { status: 1, output: [error(3, 2345), '  Type detail.'] }), undefined);
  assert.equal(laneShapeRefusal('tests/types/tsconfig.x-import-negative.json', { status: 2, output: [error(3, 2305)] }), undefined);
  assert.match(laneShapeRefusal(positive, { status: 1, output: [error(3, 2345)] }), /without output/);
  assert.match(laneShapeRefusal(positive, { status: 0, output: ['note'] }), /without output/);
  assert.match(laneShapeRefusal(negative, { status: 0, output: [] }), /at least one error/);
  assert.match(laneShapeRefusal(negative, { status: 1, output: ['  Type detail.'] }), /at least one error/);
  assert.match(laneShapeRefusal(negative, { status: 0, output: [error(3, 2345)] }), /at least one error/);
  for (const config of ['tests/types/tsconfig.json', 'tests/types/tsconfig.x.json', 'tools/tsconfig.x-positive.json', 'tests/types/../tsconfig.x-positive.json']) {
    assert.match(laneShapeRefusal(config, { status: 0, output: [] }), /not a positive or negative configuration/);
  }
});

test('TL03 the table names existing configurations, each feature with both kinds, and no file identity', () => {
  const table = readLanes(root), configs = table.lanes.map(lane => lane.config);
  assert.equal(table.compiler, JSON.parse(fs.readFileSync(new URL('../node_modules/typescript/package.json', import.meta.url), 'utf8')).version);
  for (const lane of table.lanes) {
    assert.ok(fs.existsSync(new URL('../' + lane.config, import.meta.url)), lane.config);
    assert.equal(laneShapeRefusal(lane.config, { status: lane.output.length === 0 ? 0 : 1, output: lane.output }), undefined, lane.config);
  }
  for (const config of configs) if (/-negative\.json$/.test(config) && !/-(?:import|dom-free)-negative\.json$/.test(config)) {
    assert.ok(configs.includes(config.replace(/-negative\.json$/, '-positive.json')), config);
  }
  const text = fs.readFileSync(new URL('../' + TYPE_LANES, import.meta.url), 'utf8');
  assert.equal(/sha256|"bytes"/.test(text), false);
  // No recorded line depends on where the repository is checked out.
  for (const lane of table.lanes) for (const line of lane.output) assert.equal(/[A-Za-z]:\\|\\\\|\/home\/|\/Users\//.test(line), false, line);
});

test('TL04 the checkout directory is removed in either separator, and without regard to case only on Windows', () => {
  const line = file => "x.ts(1,1): error TS2339: Property 'a' does not exist on type 'typeof import(\"" + file + "\")'.";
  const expected = line('<repository>/packages/engine/dist/index');
  assert.equal(withoutCheckout('/work/egret/', line('/work/egret/packages/engine/dist/index'), 'linux'), expected);
  assert.equal(withoutCheckout('/work/egret', line('/work/egret/packages/engine/dist/index'), 'linux'), expected);
  assert.equal(withoutCheckout('/work/egret/', line('/WORK/egret/packages/engine/dist/index'), 'linux'), line('/WORK/egret/packages/engine/dist/index'));
  assert.equal(withoutCheckout('D:\\a\\egret\\', line('D:/a/egret/packages/engine/dist/index'), 'win32'), expected);
  assert.equal(withoutCheckout('D:\\a\\egret\\', line('d:/a/egret/packages/engine/dist/index'), 'win32'), expected);
  assert.equal(withoutCheckout('D:\\a\\egret\\', 'D:\\a\\egret\\tests\\x.ts', 'win32'), '<repository>\\tests\\x.ts');
  assert.equal(withoutCheckout('/work/egret/', 'a.ts(1,1): error TS1: plain', 'linux'), 'a.ts(1,1): error TS1: plain');
});

test('TL05 the compiler prints what the table records for a positive and a negative lane', async () => {
  const table = readLanes(root);
  const positive = table.lanes.find(lane => lane.output.length === 0), negative = table.lanes.find(lane => lane.output.length > 0);
  for (const lane of [positive, negative]) {
    const observed = await compileLane(root, lane.config);
    assert.equal(laneShapeRefusal(lane.config, observed), undefined);
    assert.deepEqual(observed.output, lane.output, lane.config);
  }
});

test('TL06 the command accepts the recorded lanes and refuses an unknown option', () => {
  const tool = fileURLToPath(new URL('../tools/check-type-lanes.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [tool], { encoding: 'utf8', windowsHide: true, timeout: 600000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^Type lanes PASS: \d+ configurations compile, and fail, exactly as recorded\.\n$/);
  assert.notEqual(spawnSync(process.execPath, [tool, '--force'], { encoding: 'utf8', windowsHide: true }).status, 0);
});
