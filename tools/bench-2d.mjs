// SPDX-License-Identifier: Apache-2.0
// Fixed 2D workloads, run in Node against the built SDK without a browser or a GPU.
// Usage: node tools/bench-2d.mjs [--json] [--quick] [--rounds <n>] [--workload <id>]
// It times the CPU work of a frame before anything reaches the graphics API: turning the
// display list into a frame record (capture), and turning that record into vertex batches
// (preparation). A capture after the first one finds the records each node kept; the rows marked
// "kept" time the preparation of a frame by a Host that kept the draws and batches of the frames before.
// It also times container edits and the life of display objects.
// A capture row and every preparation row is the median of its frames, after passes that are not measured.
// Each workload runs in its own process, and a full run reports the lowest figure of several such processes.
// The figures describe this machine and this run; they are not acceptance thresholds.
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  Bitmap, DisplayObjectContainer, Event, Sprite, createAssetRef, createAssetType, createEngine, createEventType, createImageData2D, createTexture, isTexture,
} from '@egret/engine';
// The preparation stages are private to the hosts; the benchmark drives them as a host does.
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { prepareSharedBatches2D } from '../packages/engine/dist/rendering/preparedSharedBatches2D.js';
import { PreparedBatchScratch2D } from '../packages/engine/dist/rendering/preparedBatches2D.js';
import { SharedPreparationRetention2D } from '../packages/engine/dist/rendering/sharedPreparationRetention2D.js';

const quick = process.argv.includes('--quick');
const FRAME = { width: 1280, height: 720 };
// The defaults of the WebGL2 host.
const PREPARE = { pixelRatio: 1, maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576 };
const host = () => ({ surface: {}, start() {}, stop() {}, async close() {}, setTimeout(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); } });
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const results = [];
const record = (group, name, value, unit, note) => results.push({ group, name, value, unit, ...(note ? { note } : {}) });
const failure = error => 'failed: ' + (error?.code ?? error?.message ?? String(error));

// Unmeasured passes before each timed run of the preparation stages.
const WARM_PASSES = 10;
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
/** Median milliseconds of `frame` over a run, after two unmeasured calls: the second finds what the first kept. */
function perFrame(frames, before, frame) {
  before(0); frame(); before(0); frame();
  const times = [];
  for (let i = 0; i < frames; i++) { before(i); const start = performance.now(); frame(); times.push(performance.now() - start); }
  return median(times);
}
/** Times the three host stages of one frame record: clipped geometry, vertex rows and draw batches. */
function prepare(label, frame, frames) {
  const time = { geometry: [], vertices: [], batches: [] };
  let draws = 0;
  // The first passes run before the code is compiled and are not measured; the median of the rest is reported,
  // so that one pause of the collector does not move a row.
  const warm = quick ? 1 : WARM_PASSES;
  frames = Math.max(frames, quick ? 3 : 30);
  for (let i = 0; i < warm + frames; i++) {
    const scratch = new PreparedBatchScratch2D(), start = performance.now();
    const prepared = prepareSharedDraws2D(frame, FRAME.width, FRAME.height, PREPARE), geometry = performance.now();
    const packed = packSharedDraws2D(prepared), vertices = performance.now();
    const plan = prepareSharedBatches2D(packed, 33554432, scratch), batches = performance.now();
    draws = plan.draws.length;
    scratch.release(plan);
    if (i >= warm) { time.geometry.push(geometry - start); time.vertices.push(vertices - geometry); time.batches.push(batches - vertices); }
  }
  record('prepare', label + ', clipped geometry', round(median(time.geometry)), 'ms/frame');
  record('prepare', label + ', vertex rows', round(median(time.vertices)), 'ms/frame');
  record('prepare', label + ', draw batches', round(median(time.batches)), 'ms/frame', draws + ' draws');
  // The same frame again, as a Host prepares it that kept the draws and batches of the frames before.
  // The first pass keeps the geometry, the rows and the batches, the second the packed records; neither is measured.
  // A kept frame is short, so more passes are timed.
  const retention = new SharedPreparationRetention2D(), kept = { geometry: [], vertices: [], batches: [] };
  frames = Math.max(frames, quick ? 5 : 40);
  for (let i = 0; i <= frames + 1; i++) {
    const scratch = new PreparedBatchScratch2D(), start = performance.now();
    const prepared = prepareSharedDraws2D(frame, FRAME.width, FRAME.height, PREPARE, retention), geometry = performance.now();
    const packed = packSharedDraws2D(prepared), vertices = performance.now();
    const plan = prepareSharedBatches2D(packed, 33554432, scratch, retention), batches = performance.now();
    scratch.release(plan);
    if (i > 1) { kept.geometry.push(geometry - start); kept.vertices.push(vertices - geometry); kept.batches.push(batches - vertices); }
  }
  record('prepare', label + ', clipped geometry, kept', round(median(kept.geometry)), 'ms/frame');
  record('prepare', label + ', vertex rows, kept', round(median(kept.vertices)), 'ms/frame', retention.draws + ' draws kept');
  record('prepare', label + ', draw batches, kept', round(median(kept.batches)), 'ms/frame', retention.batches + ' batches kept');
}

/** Times the three host stages together over frames that are each changed and captured anew, without and with what a Host keeps. */
function changing(label, frames, change, capture) {
  frames = Math.max(frames, quick ? 5 : 40);
  for (const retention of [undefined, new SharedPreparationRetention2D()]) {
    const times = [];
    const warm = quick ? 2 : WARM_PASSES;
    for (let i = 0; i < warm + frames; i++) {
      change();
      const frame = capture(), scratch = new PreparedBatchScratch2D(), start = performance.now();
      const plan = prepareSharedBatches2D(packSharedDraws2D(prepareSharedDraws2D(frame, FRAME.width, FRAME.height, PREPARE, retention)), 33554432, scratch, retention);
      const end = performance.now();
      scratch.release(plan);
      if (i >= warm) times.push(end - start);
    }
    record('prepare', label + ', three stages' + (retention ? ', kept' : ''), round(median(times)), 'ms/frame');
  }
}

async function sprites(count) {
  const engine = await createEngine({ host: host() }), scope = engine.createScope(), layers = [], all = [];
  for (let i = 0; i < 20; i++) { const layer = scope.use(new DisplayObjectContainer()); engine.stage.addChild(layer); layers.push(layer); }
  for (let i = 0; i < count; i++) {
    const sprite = scope.use(new Sprite());
    sprite.graphics.beginFill(0x204060 + (i % 200), 1).drawRect(0, 0, 12, 12).endFill();
    sprite.x = (i * 37) % 1200; sprite.y = (i * 53) % 680;
    layers[i % 20].addChild(sprite); all.push(sprite);
  }
  const frames = quick ? 5 : count >= 20000 ? 20 : 40, capture = () => engine.captureSharedFrame(FRAME);
  const label = count + ' rectangles';
  try {
    record('capture', label + ', all moving', round(perFrame(frames, () => { for (const sprite of all) sprite.x += 1; }, capture)), 'ms/frame');
    record('capture', label + ', a tenth moving', round(perFrame(frames, () => { for (let i = 0; i < all.length; i += 10) all[i].x += 1; }, capture)), 'ms/frame');
    record('capture', label + ', nothing moving', round(perFrame(frames, () => {}, capture)), 'ms/frame');
  } catch (error) { record('capture', label, failure(error), ''); }
  try {
    prepare(label, capture(), Math.max(3, frames >> 2));
  } catch (error) { record('prepare', label, failure(error), ''); }
  scope.dispose(); await engine.dispose();
}

async function atlas(count, regions) {
  const engine = await createEngine({ host: host() }), scope = engine.createScope();
  const size = 512, pixels = new Uint8Array(size * size * 4).fill(255), image = createImageData2D({ width: size, height: size, pixels });
  const type = createAssetType('bench-2d-atlas-' + count + '-' + regions, isTexture), texture = createTexture(image);
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  const lease = scope.use(await engine.assets.acquire(createAssetRef(type, 'atlas'), { signal: scope.signal }));
  const label = count + ' bitmaps, ' + regions + ' frames of one atlas';
  try {
    const bitmaps = [];
    for (let i = 0; i < count; i++) {
      const bitmap = scope.use(new Bitmap(lease)), cell = i % regions;
      bitmaps.push(bitmap);
      bitmap.sourceRect = { x: (cell % 32) * 16, y: Math.floor(cell / 32) * 16, width: 16, height: 16 };
      bitmap.x = (i * 37) % 1200; bitmap.y = (i * 53) % 680;
      engine.stage.addChild(bitmap);
    }
    const frames = quick ? 3 : 40, capture = () => engine.captureSharedFrame(FRAME);
    record('capture', label, round(perFrame(frames, () => {}, capture)), 'ms/frame');
    prepare(label, capture(), Math.max(3, frames >> 2));
    changing(label + ', a tenth moving', frames, () => { for (let i = 0; i < count; i += 10) bitmaps[i].x += 1; }, capture);
    changing(label + ', one moving', frames, () => { bitmaps[count >> 1].x += 1; }, capture);
  } catch (error) { record('atlas', label, failure(error), ''); }
  scope.dispose(); await engine.dispose();
}

async function containers(siblings) {
  const engine = await createEngine({ host: host() }), scope = engine.createScope();
  const root = scope.use(new DisplayObjectContainer()), existing = [], fresh = [], repeat = quick ? 50 : 200;
  engine.stage.addChild(root);
  for (let i = 0; i < siblings; i++) { const child = scope.use(new Sprite()); root.addChild(child); existing.push(child); }
  for (let i = 0; i < repeat * 2; i++) fresh.push(scope.use(new Sprite()));
  const each = (name, run) => { const start = performance.now(); for (let i = 0; i < repeat; i++) run(i); record('container', name + ' among ' + siblings + ' siblings', round((performance.now() - start) / repeat * 1000, 1), 'us each'); };
  each('addChild', i => root.addChild(fresh[i]));
  each('addChildAt(new child, 0)', i => root.addChildAt(fresh[repeat + i], 0));
  each('addChildAt(existing child, 0)', i => root.addChildAt(existing[siblings - 1 - i], 0));
  each('setChildIndex', i => root.setChildIndex(existing[i], 5));
  each('removeChild', i => root.removeChild(fresh[i]));
  scope.dispose(); await engine.dispose();
}

async function lifecycle() {
  const engine = await createEngine({ host: host() }), scope = engine.createScope(), count = quick ? 2000 : 20000, objects = [];
  const root = scope.use(new DisplayObjectContainer()); engine.stage.addChild(root);
  const each = (name, total, run) => { const start = performance.now(); run(); record('object', name, round((performance.now() - start) / total * 1e6, 0), 'ns each'); };
  each('create a Sprite in a scope', count, () => { for (let i = 0; i < count; i++) objects.push(scope.use(new Sprite())); });
  each('addChild', count, () => { for (const object of objects) root.addChild(object); });
  each('write x', count * 20, () => { for (let k = 0; k < 20; k++) for (const object of objects) object.x = k; });
  each('read x', count * 20, () => { let sum = 0; for (let k = 0; k < 20; k++) for (const object of objects) sum += object.x; return sum; });
  let leaf = root;
  for (let i = 0; i < 10; i++) { const next = scope.use(new DisplayObjectContainer()); leaf.addChild(next); leaf = next; }
  const tap = createEventType('bench-2d-tap', { bubbles: true });
  root.on(tap, () => {});
  each('dispatch a bubbling event through 12 levels', count, () => { for (let i = 0; i < count; i++) leaf.dispatchEvent(new Event(tap, i)); });
  each('dispose with the scope', count, () => scope.dispose());
  await engine.dispose();
}

// Each workload runs in a process of its own, so that the heap and the compiled code one workload leaves do not
// decide the next one's figures. A full run starts every workload `--rounds` times, three by default, and reports
// the lowest figure of each row: a row can be slowed by the machine, never sped up.
const WORKLOADS = [
  ...(quick ? [1000] : [1000, 5000, 20000]).map(count => ['sprites-' + count, () => sprites(count)]),
  ['atlas-100', () => atlas(quick ? 1000 : 5000, 100)], ['atlas-200', () => atlas(quick ? 1000 : 5000, 200)],
  ...(quick ? [1000] : [1000, 4000, 16000]).map(siblings => ['containers-' + siblings, () => containers(siblings)]),
  ['lifecycle', lifecycle],
];
const option = name => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]; };
const only = option('--workload');
if (only !== undefined) {
  const found = WORKLOADS.find(([id]) => id === only);
  if (!found) throw new TypeError('Unknown workload ' + only + '; one of ' + WORKLOADS.map(([id]) => id).join(', '));
  await found[1]();
} else {
  const rounds = Number(option('--rounds') ?? (quick ? 1 : 3));
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 20) throw new TypeError('--rounds takes a whole number from 1 to 20');
  const script = fileURLToPath(import.meta.url);
  for (const [id] of WORKLOADS) {
    const rows = new Map();
    for (let round = 0; round < rounds; round++) {
      const child = spawnSync(process.execPath, [script, '--json', '--workload', id, ...(quick ? ['--quick'] : [])], { encoding: 'utf8', maxBuffer: 16777216 });
      if (child.status !== 0) throw new Error('Workload ' + id + ' failed: ' + child.stderr);
      for (const row of JSON.parse(child.stdout)) {
        const key = row.group + '\n' + row.name, best = rows.get(key);
        // A row that failed has a message for its value and is kept as it is.
        if (best === undefined || (typeof row.value === 'number' && typeof best.value === 'number' && row.value < best.value)) rows.set(key, row);
      }
    }
    results.push(...rows.values());
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else for (const row of results) console.log(row.group.padEnd(10) + row.name.padEnd(58) + String(row.value).padStart(10) + ' ' + row.unit + (row.note ? '  (' + row.note + ')' : ''));
