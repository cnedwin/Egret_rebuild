// SPDX-License-Identifier: Apache-2.0
// Fixed 2D workloads, run in Node against the built SDK without a browser or a GPU.
// Usage: node tools/bench-2d.mjs [--json] [--quick]
// It times the CPU work of a frame before anything reaches the graphics API: turning the
// display list into a frame record (capture), and turning that record into vertex batches
// (preparation). It also times container edits and the life of display objects.
// The figures describe this machine and this run; they are not acceptance thresholds.
import { performance } from 'node:perf_hooks';
import {
  Bitmap, DisplayObjectContainer, Event, Sprite, createAssetRef, createAssetType, createEngine, createEventType, createImageData2D, createTexture, isTexture,
} from '@egret/engine';
// The preparation stages are private to the hosts; the benchmark drives them as a host does.
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { prepareSharedBatches2D } from '../packages/engine/dist/rendering/preparedSharedBatches2D.js';
import { PreparedBatchScratch2D } from '../packages/engine/dist/rendering/preparedBatches2D.js';

const quick = process.argv.includes('--quick');
const FRAME = { width: 1280, height: 720 };
// The defaults of the WebGL2 host.
const PREPARE = { pixelRatio: 1, maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576 };
const host = () => ({ surface: {}, start() {}, stop() {}, async close() {}, setTimeout(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); } });
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const results = [];
const record = (group, name, value, unit, note) => results.push({ group, name, value, unit, ...(note ? { note } : {}) });
const failure = error => 'failed: ' + (error?.code ?? error?.message ?? String(error));

/** Mean milliseconds of `frame` over a run, after one unmeasured call. */
function perFrame(frames, before, frame) {
  frame();
  const start = performance.now();
  for (let i = 0; i < frames; i++) { before(i); frame(); }
  return (performance.now() - start) / frames;
}
/** Times the three host stages of one frame record: clipped geometry, vertex rows and draw batches. */
function prepare(label, frame, frames) {
  const time = { geometry: 0, vertices: 0, batches: 0 };
  let draws = 0;
  for (let i = 0; i <= frames; i++) {
    const scratch = new PreparedBatchScratch2D(), start = performance.now();
    const prepared = prepareSharedDraws2D(frame, FRAME.width, FRAME.height, PREPARE), geometry = performance.now();
    const packed = packSharedDraws2D(prepared), vertices = performance.now();
    const plan = prepareSharedBatches2D(packed, 33554432, scratch), batches = performance.now();
    draws = plan.draws.length;
    scratch.release(plan);
    // The first pass is not measured.
    if (i > 0) { time.geometry += geometry - start; time.vertices += vertices - geometry; time.batches += batches - vertices; }
  }
  record('prepare', label + ', clipped geometry', round(time.geometry / frames), 'ms/frame');
  record('prepare', label + ', vertex rows', round(time.vertices / frames), 'ms/frame');
  record('prepare', label + ', draw batches', round(time.batches / frames), 'ms/frame', draws + ' draws');
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
  const frames = quick ? 5 : count >= 20000 ? 8 : 30, capture = () => engine.captureSharedFrame(FRAME);
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
    for (let i = 0; i < count; i++) {
      const bitmap = scope.use(new Bitmap(lease)), cell = i % regions;
      bitmap.sourceRect = { x: (cell % 32) * 16, y: Math.floor(cell / 32) * 16, width: 16, height: 16 };
      bitmap.x = (i * 37) % 1200; bitmap.y = (i * 53) % 680;
      engine.stage.addChild(bitmap);
    }
    const frames = quick ? 3 : 15, capture = () => engine.captureSharedFrame(FRAME);
    record('capture', label, round(perFrame(frames, () => {}, capture)), 'ms/frame');
    prepare(label, capture(), Math.max(3, frames >> 2));
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

for (const count of quick ? [1000] : [1000, 5000, 20000]) await sprites(count);
await atlas(quick ? 1000 : 5000, 100);
await atlas(quick ? 1000 : 5000, 200);
for (const siblings of quick ? [1000] : [1000, 4000, 16000]) await containers(siblings);
await lifecycle();

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else for (const row of results) console.log(row.group.padEnd(10) + row.name.padEnd(58) + String(row.value).padStart(10) + ' ' + row.unit + (row.note ? '  (' + row.note + ')' : ''));
