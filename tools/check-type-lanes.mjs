// SPDX-License-Identifier: Apache-2.0
// The public type behavior of a feature, as the compiler reports it. A lane is one compiler
// configuration and the exact text the compiler must print for it. No file identity is recorded:
// a change to a product file passes while the consumers compile, and fail, exactly as recorded.
// Usage: node tools/check-type-lanes.mjs [--record]
//   (no option)  compile every lane and compare with tests/types/type-lanes.json
//   --record     rewrite that file from what the compiler prints now; review the difference
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TYPE_LANES = 'tests/types/type-lanes.json';
const LANE = /^tests\/types\/tsconfig\.[a-z0-9]+(?:-[a-z0-9]+)*-(positive|negative)\.json$/;
// Variables that would load other code into the compiler process or change what it resolves.
const FOREIGN = /^(?:NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_REPL_EXTERNAL_MODULE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i;

/**
 * The compiler names a module by where it is on this machine. Replace the checkout directory,
 * in either separator, so that one record serves every machine.
 */
export function withoutCheckout(root, text, platform = process.platform) {
  const flags = platform === 'win32' ? 'gi' : 'g', literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directory = root.replace(/[\\/]+$/, '');
  let result = text;
  for (const spelling of new Set([directory, directory.replaceAll('\\', '/'), directory.replaceAll('/', '\\')])) result = result.replace(new RegExp(literal(spelling), flags), '<repository>');
  return result;
}

/** The compiler's printed lines for one configuration, free of the platform's line ending and the checkout directory. */
export function compileLane(root, config) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (FOREIGN.test(key)) delete env[key];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--project', config, '--pretty', 'false'], { cwd: root, env, windowsHide: true });
    const out = [], err = [];
    const timer = setTimeout(() => child.kill(), 180000);
    child.stdout.on('data', chunk => out.push(chunk)); child.stderr.on('data', chunk => err.push(chunk));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString('utf8');
      if (signal !== null || stderr !== '') reject(new Error('The compiler did not complete for ' + config + (stderr ? ': ' + stderr.trim() : '')));
      else resolve({ status, output: withoutCheckout(fs.realpathSync(root), withoutCheckout(root, Buffer.concat(out).toString('utf8'))).replaceAll('\r\n', '\n').split('\n').filter(line => line !== '') });
    });
  });
}

/**
 * Why an observed lane cannot be a lane at all, or undefined. A positive lane prints nothing and
 * exits with zero; a negative lane prints at least one error and does not exit with zero.
 */
export function laneShapeRefusal(config, observed) {
  const kind = LANE.exec(config)?.[1];
  if (kind === undefined) return 'not a positive or negative configuration under tests/types';
  const errors = observed.output.filter(line => /\): error TS\d+: /.test(line)).length;
  if (kind === 'positive') return observed.status === 0 && observed.output.length === 0 ? undefined : 'a positive lane must compile without output';
  return observed.status !== 0 && errors > 0 ? undefined : 'a negative lane must report at least one error';
}

/** The recorded lines an observation lacks and the observed lines that were not recorded. */
export function laneDifference(recorded, observed) {
  const count = lines => { const seen = new Map(); for (const line of lines) seen.set(line, (seen.get(line) ?? 0) + 1); return seen; };
  const had = count(recorded), has = count(observed), missing = [], unexpected = [];
  for (const [line, times] of had) for (let n = has.get(line) ?? 0; n < times; n++) missing.push(line);
  for (const [line, times] of has) for (let n = had.get(line) ?? 0; n < times; n++) unexpected.push(line);
  const reordered = missing.length === 0 && unexpected.length === 0 && recorded.some((line, index) => line !== observed[index]);
  return { missing, unexpected, reordered };
}

export function readLanes(root) {
  const table = JSON.parse(fs.readFileSync(path.join(root, TYPE_LANES), 'utf8'));
  if (table.schemaVersion !== 1 || table.kind !== 'egret.type-lanes/1' || typeof table.compiler !== 'string' || !Array.isArray(table.lanes) || table.lanes.length === 0
    || table.lanes.some(lane => !lane || typeof lane.config !== 'string' || !LANE.test(lane.config) || !Array.isArray(lane.output) || lane.output.some(line => typeof line !== 'string' || line === '')
      || Object.keys(lane).join() !== 'config,output')
    || new Set(table.lanes.map(lane => lane.config)).size !== table.lanes.length) throw new Error(TYPE_LANES + ' is not a type lane table');
  return table;
}

async function inTurn(items, width, work) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => { while (next < items.length) { const index = next++; results[index] = await work(items[index]); } }));
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2), root = fileURLToPath(new URL('..', import.meta.url));
  if (options.length > 1 || options.some(option => option !== '--record')) throw new TypeError('Usage: node tools/check-type-lanes.mjs [--record]');
  const table = readLanes(root), compiler = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/typescript/package.json'), 'utf8')).version;
  const observed = await inTurn(table.lanes, Math.max(1, Math.min(4, os.availableParallelism())), lane => compileLane(root, lane.config));
  const failures = [];
  for (const [index, lane] of table.lanes.entries()) { const refusal = laneShapeRefusal(lane.config, observed[index]); if (refusal) failures.push(lane.config + ': ' + refusal); }
  if (options[0] === '--record') {
    if (failures.length) { console.error(failures.join('\n')); throw new Error('Nothing was recorded.'); }
    const next = { schemaVersion: 1, kind: 'egret.type-lanes/1', compiler, lanes: table.lanes.map((lane, index) => ({ config: lane.config, output: observed[index].output })) };
    fs.writeFileSync(path.join(root, TYPE_LANES), JSON.stringify(next, null, 1) + '\n');
    console.log('Recorded ' + next.lanes.length + ' type lanes under compiler ' + compiler + '. Review the difference before committing it.');
  } else {
    if (table.compiler !== compiler) failures.push('The lanes were recorded under compiler ' + table.compiler + '; the installed compiler is ' + compiler + '.');
    for (const [index, lane] of table.lanes.entries()) {
      const difference = laneDifference(lane.output, observed[index].output);
      for (const line of difference.missing) failures.push(lane.config + ': no longer reported: ' + line);
      for (const line of difference.unexpected) failures.push(lane.config + ': not recorded: ' + line);
      if (difference.reordered) failures.push(lane.config + ': the same lines are reported in another order');
    }
    if (failures.length) {
      console.error(failures.join('\n'));
      console.error('Type lanes differ. If the public types were meant to change, run node tools/check-type-lanes.mjs --record and review the difference.');
      process.exit(1);
    }
    console.log('Type lanes PASS: ' + table.lanes.length + ' configurations compile, and fail, exactly as recorded.');
  }
}
