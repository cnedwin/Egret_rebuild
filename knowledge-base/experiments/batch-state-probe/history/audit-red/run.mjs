import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildBatches, executeBatchesCPU } from './model.mjs';
const results = [];
const test = (name, fn) => { try { results.push({ name, status: 'passed', observations: fn() ?? {} }); } catch (e) { results.push({ name, status: 'failed', error: e.message }); } };
const textures = { white: [1, 1, 1, 1], violet: [.5, .2, .9, 1] };
const draw = (color, pipeline = 'straight', clip = null, texture = 'white', rect = [0, 0, 8, 8]) => ({ color, pipeline, clip, texture, rect });
function reference(commands, width = 8, height = 8) {
  // Pixel-first full reference reads each command state, never a batch header.
  const out = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let pixel = [0, 0, 0, 0];
    for (const c of commands) {
      const [left, bottom, right, top] = c.rect;
      if (!(x >= left && y >= bottom && x < right && y < top)) continue;
      if (c.clip && !(x >= c.clip[0] && y >= c.clip[1] && x < c.clip[2] && y < c.clip[3])) continue;
      const t = textures[c.texture], a = c.color[3] * t[3];
      pixel = [0, 1, 2].map(k => Math.min(1, c.color[k] * t[k] * a + pixel[k] * (c.pipeline === 'add' ? 1 : 1 - a))).concat(a + pixel[3] * (1 - a));
    }
    out.push(...pixel);
  }
  return out;
}
const consume = c => executeBatchesCPU(buildBatches(c), 8, 8, textures);
test('Clip changes cannot borrow another batch clip', () => {
  const commands = [draw([0, 0, 1, 1], 'straight', [0, 0, 4, 8]), draw([1, 0, 0, 1], 'straight', [4, 0, 8, 8])];
  const pixels = consume(commands); assert.deepEqual(pixels, reference(commands));
  assert.deepEqual(pixels.slice(0, 4), [0, 0, 1, 1]); assert.deepEqual(pixels.slice(16, 20), [1, 0, 0, 1]);
});
test('Additive and straight alpha cannot share one pipeline', () => {
  const commands = [draw([1, 0, 0, .5]), draw([0, 1, 0, .5], 'add')];
  const pixels = consume(commands); assert.deepEqual(pixels, reference(commands)); assert.deepEqual(pixels.slice(0, 4), [.5, .5, 0, .75]);
});
test('Texture boundaries affect actual sampled color', () => {
  const c = [draw([1, 1, 1, 1]), draw([1, 1, 1, .5], 'straight', null, 'violet')];
  assert.deepEqual(consume(c), reference(c)); assert.deepEqual(consume(c).slice(0, 4), [.75, .6, .95, 1]);
});
test('Compatible adjacent geometry can share a draw batch without reordering', () => {
  const c = [draw([1, 0, 0, .5]), draw([0, 1, 0, .5]), draw([0, 0, 1, .5])];
  assert.equal(buildBatches(c).length, 1); assert.deepEqual(consume(c), reference(c)); assert.deepEqual(consume(c).slice(0, 4), [.125, .25, .5, .875]);
});
test('Vertex capacity splits geometry without changing output', () => {
  const c = Array.from({ length: 10 }, (_, i) => draw([i / 10, .3, .2, .5]));
  const b = buildBatches(c, 24); assert.equal(b.length, 3); assert(b.every(x => x.commands.length * 6 <= 24));
  assert.deepEqual(executeBatchesCPU(b, 8, 8, textures), reference(c));
});
test('Unsupported pipeline and malformed clip are rejected before batching', () => {
  assert.throws(() => buildBatches([draw([1, 1, 1, 1], 'unknown')]));
  assert.throws(() => buildBatches([draw([1, 1, 1, 1], 'straight', [0, 0, NaN, 2])]));
  assert.throws(() => buildBatches([], 5));
  assert.throws(() => buildBatches([{ ...draw([1, 1, 1, 1]), color: new Array(4) }]));
});
let seed = 20261008, state = seed;
const random = n => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return Math.floor(state / 4294967296 * n); };
test('Seeded independent batch consumer equals full per-command oracle', () => {
  for (let scene = 0; scene < 100; scene++) {
    const c = Array.from({ length: 24 }, () => draw([random(10) / 10, random(10) / 10, random(10) / 10, .2 + random(8) / 10], random(2) ? 'straight' : 'add', random(2) ? [2, 1, 7, 6] : null, random(2) ? 'white' : 'violet', [random(3), random(3), 5 + random(4), 5 + random(4)]));
    const a = consume(c), b = reference(c); assert(a.every((v, i) => Math.abs(v - b[i]) < 1e-12));
  }
  return { scenes: 100, commandsPerScene: 24, seed, reference: 'independent_pixel_first_per_command' };
});
test('Global texture sort still has a transparent-order counterexample', () => {
  const c = [draw([1, 0, 0, .5]), draw([0, 1, 0, .5], 'straight', null, 'violet'), draw([0, 0, 1, .5])];
  const bad = [...c].sort((a, b) => a.texture.localeCompare(b.texture));
  assert.notDeepEqual(reference(c), reference(bad)); return { original: reference(c).slice(0, 4), incorrect: reference(bad).slice(0, 4) };
});
const sourceHashes = [];
for (const file of ['model.mjs', 'run.mjs']) sourceHashes.push({ path: file, sha256: createHash('sha256').update(await readFile(new URL(file, import.meta.url))).digest('hex') });
const counts = { total: results.length, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length };
const report = { schemaVersion: 1, experiment: 'independent_batch_state_probe', checkedAtUtc: new Date().toISOString(), environment: { node: process.version, platform: process.platform }, counts, results, sourceHashes, limitations: ['Finite rectangle, single-texel, straight/additive alpha model only.', 'Independent CPU consumer uses batch header state; no arbitrary mask/filter/stencil or full material system.', 'No GPU timing, engine performance or production host acceptance.'] };
await writeFile(new URL('../../evidence/batch-state-probe-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ experiment: report.experiment, counts })); process.exitCode = counts.failed ? 1 : 0;
