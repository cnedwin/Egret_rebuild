// SPDX-License-Identifier: Apache-2.0
// CPU UNIT only. These private inputs establish no public frame or native authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import { admitSharedWebGL2Options } from '../packages/engine/dist/web/sharedWebGL2Options.js';
import {
  qualifySharedWebGL2Alignment, planSharedWebGL2Arenas, checkSharedWebGL2ArenaCapacity,
} from '../packages/engine/dist/web/sharedWebGL2Arena.js';

const TOP = ['canvas', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels', 'maxCommands',
  'maxClipRectangles', 'maxPreparedVertices', 'maxClipEdgeTests', 'maxUploadBytes',
  'maxPendingUploadBytes', 'maxPendingFrames', 'maxReadbackBytes', 'enableReadback',
  'maxSourceTriangles', 'maxFrameGeometryBytes', 'maxPendingGeometryBytes',
  'maxTupleComparisons', 'outputAlpha', 'restoreTimeoutMs'];
const DEFAULTS = Object.freeze({
  pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144,
  maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432,
  maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864,
  enableReadback: false, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216,
  maxPendingGeometryBytes: 33554432, maxTupleComparisons: 1048576,
  outputAlpha: 'premultiplied', restoreTimeoutMs: 10000,
});
const canvas = Object.freeze({ getContext() { assert.fail('pure admission must not acquire a context'); } });
const admit = (extra = {}, scene = false) => admitSharedWebGL2Options({ canvas, ...extra }, scene);
const numericCaps = Object.keys(DEFAULTS).filter(key => key.startsWith('max'));
const owner = (pendingVertexArenaBytes = 0, pendingUniformArenaBytes = 0) =>
  Object.freeze({ pendingVertexArenaBytes, pendingUniformArenaBytes });
function draw(vertexCount = 3, marker = 1) {
  return Object.freeze({ prepared: Object.freeze({ unitOnly: true }),
    data: new Float32Array(vertexCount * 11).fill(marker), vertexCount,
    uniform: new Uint8Array(128).fill(marker) });
}
const sceneUniform = marker => new Float32Array(16).fill(marker);

test('UNIT GLP01 options snapshot all named getters once and ignore unknown properties', () => {
  const trace = [], callback = () => {}, values = { canvas, onDiagnostic: callback };
  const input = Object.defineProperties({}, Object.fromEntries(TOP.map(key => [key, {
    get() { trace.push(key); return values[key]; },
  }])));
  for (const key of ['device', 'context', 'attributes', 'extension'])
    Object.defineProperty(input, key, { get() { assert.fail('unknown option read: ' + key); } });
  const result = admitSharedWebGL2Options(input, false);
  assert.deepEqual(trace, TOP);
  assert.equal(result.surface, canvas);
  assert.equal(result.callback, callback);
  assert.deepEqual(result.configuration, DEFAULTS);
  assert.ok(Object.isFrozen(result.configuration));
  values.pixelRatio = 3; values.restoreTimeoutMs = 1;
  assert.deepEqual(result.configuration, DEFAULTS);
  assert.deepEqual(trace, TOP, 'configuration reads must not reread caller getters');
});

test('UNIT GLP02 a getter cause precedes semantics and stops only later option reads', () => {
  for (const stop of ['restoreTimeoutMs', 'maxUploadBytes']) {
    const trace = [], cause = Object.freeze({ stop });
    const input = Object.defineProperties({}, Object.fromEntries(TOP.map(key => [key, {
      get() {
        trace.push(key);
        if (key === stop) throw cause;
        return key === 'canvas' ? canvas : key === 'maxBackingPixels' ? -1 : undefined;
      },
    }])));
    assert.throws(() => admitSharedWebGL2Options(input, false), error => error === cause);
    assert.deepEqual(trace, TOP.slice(0, TOP.indexOf(stop) + 1));
  }
});

test('UNIT GLP03 option scalar domains preserve lowered caps without coercion', () => {
  for (const key of numericCaps) {
    for (const value of [1, DEFAULTS[key]])
      assert.equal(admit({ [key]: value }).configuration[key], value, key);
    for (const value of [0, -1, 0.5, NaN, Infinity, -Infinity, DEFAULTS[key] + 1, '1', null])
      assert.throws(() => admit({ [key]: value }), key + ': ' + String(value));
  }
  for (const value of [0.25, 3.5, Number.MAX_VALUE])
    assert.equal(admit({ pixelRatio: value }).configuration.pixelRatio, value);
  for (const value of [0, -1, NaN, Infinity, '1', null])
    assert.throws(() => admit({ pixelRatio: value }));
  for (const value of [false, true]) assert.equal(admit({ enableReadback: value }).configuration.enableReadback, value);
  for (const value of [0, 1, 'true', null]) assert.throws(() => admit({ enableReadback: value }));
  assert.equal(admit().callback, undefined);
  const callback = () => {}; assert.equal(admit({ onDiagnostic: callback }).callback, callback);
  for (const value of [null, 1, {}, 'callback']) assert.throws(() => admit({ onDiagnostic: value }));
  for (const value of [undefined, null, false, 1, 'options', () => {}])
    assert.throws(() => admitSharedWebGL2Options(value, false));
  for (const value of [undefined, null, false, 1, 'canvas', () => {}])
    assert.throws(() => admit({ canvas: value }));
});

test('UNIT GLP04 scene opacity is explicit and restore timeout has a distinct maximum', () => {
  assert.equal(admit().configuration.outputAlpha, 'premultiplied');
  assert.equal(admit({ outputAlpha: 'opaque' }).configuration.outputAlpha, 'opaque');
  assert.equal(admit({ outputAlpha: 'opaque' }, true).configuration.outputAlpha, 'opaque');
  for (const value of [undefined, 'premultiplied', null, 'opaque-ish'])
    assert.throws(() => admit({ outputAlpha: value }, true));
  for (const value of [null, 'opaque-ish', 1]) assert.throws(() => admit({ outputAlpha: value }));
  assert.equal(admit().configuration.restoreTimeoutMs, 10000);
  for (const value of [1, 10000, 10001, 30000])
    assert.equal(admit({ restoreTimeoutMs: value }).configuration.restoreTimeoutMs, value);
  for (const value of [0, -1, 0.5, 30001, NaN, Infinity, '10000', null])
    assert.throws(() => admit({ restoreTimeoutMs: value }));
});

test('UNIT GLP05 original payloads use literal whole-record ranges including final UBO padding', () => {
  const draws = Object.freeze([draw(3, 7), draw(6, 9)]);
  const scene = Object.freeze([sceneUniform(2), sceneUniform(5)]);
  const before = [...draws.flatMap(d => [Array.from(d.data), Array.from(d.uniform)]), ...scene.map(value => Array.from(value))];
  const cases = [
    [4, 128, 64, 384, [0, 128], [256, 320]],
    [12, 132, 72, 408, [0, 132], [264, 336]],
    [16, 128, 64, 384, [0, 128], [256, 320]],
    [256, 256, 256, 1024, [0, 256], [512, 768]],
  ];
  for (const [alignment, sharedStride, sceneStride, uniformBytes, sharedOffsets, sceneOffsets] of cases) {
    assert.deepEqual(qualifySharedWebGL2Alignment(alignment), { sharedStride, sceneStride });
    const plan = planSharedWebGL2Arenas(draws, scene, alignment);
    assert.equal(plan.vertexBytes, 396);
    assert.equal(plan.uniformBytes, uniformBytes);
    assert.deepEqual(plan.sharedRanges.map(r => [r.vertexOffset, r.firstVertex, r.uniformOffset, r.uniformSize]),
      [[0, 0, sharedOffsets[0], 128], [132, 3, sharedOffsets[1], 128]]);
    assert.deepEqual(plan.sceneRanges.map(r => [r.uniformOffset, r.uniformSize]),
      [[sceneOffsets[0], 64], [sceneOffsets[1], 64]]);
    for (let i = 0; i < draws.length; i++) assert.equal(plan.sharedRanges[i].draw, draws[i]);
    for (let i = 0; i < scene.length; i++) assert.equal(plan.sceneRanges[i].uniform, scene[i]);
  }
  assert.deepEqual([...draws.flatMap(d => [Array.from(d.data), Array.from(d.uniform)]), ...scene.map(value => Array.from(value))], before);
});

test('UNIT GLP06 no-draw and scene-only layouts retain finite non-power-of-two admission', () => {
  const empty = planSharedWebGL2Arenas([], [], 12);
  assert.deepEqual([empty.vertexBytes, empty.uniformBytes, empty.sharedRanges, empty.sceneRanges], [0, 0, [], []]);
  const scene = [sceneUniform(1), sceneUniform(2)], only = planSharedWebGL2Arenas([], scene, 12);
  assert.equal(only.vertexBytes, 0); assert.equal(only.uniformBytes, 144);
  assert.deepEqual(only.sharedRanges, []);
  assert.deepEqual(only.sceneRanges.map(r => [r.uniformOffset, r.uniformSize]), [[0, 64], [72, 64]]);
  for (const value of [3, 0, -4, 6, 257, 12.5, NaN, Infinity, '12']) {
    assert.throws(() => qualifySharedWebGL2Alignment(value));
    assert.throws(() => planSharedWebGL2Arenas([], [], value));
  }
  // Individual native block-size qualification belongs to Host startup. U above
  // 128 bytes is valid metadata; MAX_UNIFORM_BLOCK_SIZE is not an arena cap.
});

test('UNIT GLP07 finite draw and byte arithmetic refuses overflow without large payload copies', () => {
  const unit = draw(), uniform = sceneUniform(1);
  const full = planSharedWebGL2Arenas(Array(65536).fill(unit), Array(64).fill(uniform), 256);
  assert.equal(full.vertexBytes, 8650752);
  assert.equal(full.uniformBytes, 16793600);
  assert.equal(full.sharedRanges.length, 65536); assert.equal(full.sceneRanges.length, 64);
  assert.equal(full.sceneRanges[63].uniformOffset, 16793344);
  assert.throws(() => planSharedWebGL2Arenas(Array(65537).fill(unit), [], 256));
  assert.throws(() => planSharedWebGL2Arenas([], Array(65).fill(uniform), 256));
  for (const bad of [
    { ...unit, vertexCount: 0 }, { ...unit, vertexCount: 4 },
    { ...unit, uniform: new Uint8Array(127) },
  ]) assert.throws(() => planSharedWebGL2Arenas([bad], [], 12));
  assert.throws(() => planSharedWebGL2Arenas([], [new Float32Array(15)], 12));
  // Numeric-only UNIT metadata, deliberately not uploadable SDK/native payloads.
  // The nominal V cap is not 44/132-byte aligned; no valid exact-cap frame is claimed.
  const numericDraw = bytes => ({ prepared: {}, data: { byteLength: bytes },
    vertexCount: bytes / 44, uniform: { byteLength: 128 } });
  assert.equal(planSharedWebGL2Arenas([numericDraw(33554400)], [], 4).vertexBytes, 33554400);
  for (const bytes of [33554532, Number.MAX_SAFE_INTEGER, Infinity, -132])
    assert.throws(() => planSharedWebGL2Arenas([numericDraw(bytes)], [], 4));
});

test('UNIT GLP08 pending arena checks are pure and must be repeated for a changed owner snapshot', () => {
  const plan = planSharedWebGL2Arenas([draw(3), draw(6)], [sceneUniform(1), sceneUniform(2)], 12);
  const snapshot = { vertexBytes: plan.vertexBytes, uniformBytes: plan.uniformBytes };
  checkSharedWebGL2ArenaCapacity(plan, owner());
  // Exact-fit/+1 are arithmetic-only counter controls, not reachable Host frames.
  const exact = owner(67108864 - 396, 33587200 - 408);
  checkSharedWebGL2ArenaCapacity(plan, exact);
  assert.throws(() => checkSharedWebGL2ArenaCapacity(plan, owner(exact.pendingVertexArenaBytes + 1, 0)));
  assert.throws(() => checkSharedWebGL2ArenaCapacity(plan, owner(0, exact.pendingUniformArenaBytes + 1)));
  for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => checkSharedWebGL2ArenaCapacity(plan, owner(bad, 0)));
    assert.throws(() => checkSharedWebGL2ArenaCapacity(plan, owner(0, bad)));
  }
  assert.deepEqual(exact, owner(67108864 - 396, 33587200 - 408));
  assert.deepEqual({ vertexBytes: plan.vertexBytes, uniformBytes: plan.uniformBytes }, snapshot);
  // Host controls must separately prove the final recheck happens before serial,
  // owner and native commit. This unit only establishes the reusable pure check.
});
