import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';
import { TexturedPreparationBudget2D } from '../packages/engine/dist/rendering/texturedPreparationBudget2D.js';
import { GeometryPreparationError, coordinate } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import * as projectionModule from '../packages/engine/dist/web/imageProjections2D.js';
import { FRAME_OPTIONS, PREPARATION_OPTIONS, LEDGER_LIMITS, STORAGE_OPTIONS, HARDWARE,
  OWNER, ZERO_COUNTERS, IDENTITY, ORACLE, unitFrame, meshCommand, imageCommand,
  rectCommand, lengthUnit } from './fixtures/textured-frame-admission-oracles.mjs';

// First-party Apache-2.0 UNEXECUTED Task3 candidate. Future location R/tests.
// Genuine captures exercise trusted CPU admission, not a WebGPU port or native GPU.
// Explicit PRIVATE UNIT names below never claim frame registration/host behavior.
const admissionURL = new URL('../packages/engine/dist/rendering/admitTexturedFrame2D.js', import.meta.url);
const submissionURL = new URL('../packages/engine/dist/web/prepareTexturedSubmission2D.js', import.meta.url);
const drawsURL = new URL('../packages/engine/dist/rendering/prepareTexturedDraws2D.js', import.meta.url);
const originURL = new URL('../packages/engine/dist/rendering/ownedPreparationFailure2D.js', import.meta.url);
const meshPackerURL = new URL('../packages/engine/dist/rendering/packTexturedMesh2D.js', import.meta.url);
async function optionalExact(url) {
  try { return await import(url.href); }
  catch (cause) {
    // Transitive absence, syntax/dependency faults and unrelated failures remain setup faults.
    if (cause?.code === 'ERR_MODULE_NOT_FOUND' && cause?.url === url.href) return undefined;
    throw cause;
  }
}
const admissionModule = await optionalExact(admissionURL);
function admission() {
  assert.equal(typeof admissionModule?.admitTexturedFrame2D, 'function', 'P01 missing admitTexturedFrame2D');
  return admissionModule.admitTexturedFrame2D;
}
async function submission() {
  const module = await optionalExact(submissionURL);
  assert.equal(typeof module?.prepareTexturedSubmission2D, 'function', 'Task3 private submission helper prerequisite');
  assert.equal(typeof module?.planTexturedSubmissionStorage2D, 'function', 'Task3 private storage helper prerequisite');
  assert.equal(typeof module?.isTexturedSubmissionAdmissionError2D, 'function', 'Task3 private admission-origin classifier');
  return module;
}
function projections(frame, observer) {
  assert.equal(typeof projectionModule.planTexturedImageProjections, 'function', 'Task3 trusted projection facade prerequisite');
  return projectionModule.planTexturedImageProjections(frame, observer);
}
function ledger(maxSourceTriangles = 65536) {
  return new TexturedPreparationBudget2D({ ...LEDGER_LIMITS, maxSourceTriangles });
}
function reason(run, expected) {
  // A private helper reason assertion, NOT public-code classification or host acceptance.
  assert.throws(run, cause => cause?.reason === expected, 'private reason: ' + expected);
}
function ownedGeometry(triangleCount = 1, { vertexCount = 3, unusedExtreme = false,
  positions = [2, 2, 6, 2, 2, 6] } = {}) {
  const xy = new Float64Array(vertexCount * 2); xy.set(positions);
  if (unusedExtreme) xy[xy.length - 2] = Number.MAX_VALUE;
  const indices = new Uint32Array(3 * triangleCount);
  for (let i = 0; i < indices.length; i += 3) indices.set([0, 1, 2], i);
  return egret.createTexturedGeometry2D({ positions: xy, uvs: new Float64Array(vertexCount * 2),
    lightColors: new Float64Array(vertexCount * 4).fill(1), indices });
}
function emptyGeometry() {
  return egret.createTexturedGeometry2D({ positions: new Float64Array(), uvs: new Float64Array(),
    lightColors: new Float64Array(), indices: new Uint32Array() });
}
function ownedImage(width = 1, height = 1) {
  return egret.createImageData2D({ width, height, pixels: new Uint8Array(4 * width * height).fill(255) });
}
let resourceId = 0;
async function fixture(geometries = [ownedGeometry()], { imageWidth = 1, imageHeight = 1, dimensions = { width: 8, height: 8 } } = {}) {
  for (const name of ['createEngine', 'Engine', 'AssetManager', 'AssetLease', 'Mesh2D',
    'createAssetType', 'createAssetRef', 'createTexture', 'createImageData2D',
    'createTexturedGeometry2D', 'isTexturedGeometry2D', 'isImageData2D']) {
    assert.equal(typeof egret[name], 'function', 'accepted public prerequisite ' + name);
  }
  const port = host(), engine = await egret.createEngine({ host: port.adapter });
  const image = ownedImage(imageWidth, imageHeight), texture = egret.createTexture(image);
  let lease; const meshes = [];
  const close = async () => {
    const failures = [];
    for (let i = meshes.length - 1; i >= 0; i--) {
      try { meshes[i].dispose(); } catch (cause) { failures.push(cause); }
    }
    try { lease?.release(); } catch (cause) { failures.push(cause); }
    try { await engine.dispose(); } catch (cause) { failures.push(cause); }
    try { texture.dispose(); } catch (cause) { failures.push(cause); }
    if (failures.length) throw new AggregateError(failures, 'Task3 genuine fixture cleanup failed');
  };
  try {
    const key = 'task3-admission-' + (++resourceId);
    const type = egret.createAssetType(key, egret.isTexture);
    engine.assets.register(type, { load: async () => texture, dispose: value => value.dispose() });
    lease = await engine.assets.acquire(egret.createAssetRef(type, key));
    for (const geometry of geometries) {
      const mesh = new egret.Mesh2D(lease, geometry); meshes.push(mesh); engine.stage.addChild(mesh);
    }
    assert.equal(engine instanceof egret.Engine, true); assert.equal(engine.assets instanceof egret.AssetManager, true);
    assert.equal(lease instanceof egret.AssetLease, true); assert.equal(lease.value, texture);
    assert.equal(egret.isImageData2D(image), true); assert.equal(Object.isFrozen(image), true);
    for (let i = 0; i < meshes.length; i++) {
      assert.equal(egret.isTexturedGeometry2D(geometries[i]), true);
      for (const value of [geometries[i], geometries[i].positions, geometries[i].uvs,
        geometries[i].lightColors, geometries[i].indices]) assert.equal(Object.isFrozen(value), true);
      assert.equal(meshes[i].geometry, geometries[i]); assert.equal(meshes[i].textureLease, lease);
      assert.equal(engine.stage.getChildAt(i), meshes[i]);
    }
    const frame = engine.captureTexturedFrame(dimensions);
    assert.equal(frame.profile, 'egret.textured-frame2d/1'); assert.equal(frame.frameId, 1);
    assert.equal(frame.commands.length, geometries.length); assert.equal(frame.images[0], image);
    for (const value of [frame, frame.commands, frame.images, frame.geometries, ...frame.commands]) assert.equal(Object.isFrozen(value), true);
    for (let i = 0; i < meshes.length; i++) {
      assert.equal(frame.geometries[frame.commands[i].geometryIndex], geometries[i]);
      for (const value of [frame.commands[i].matrix, frame.commands[i].clips, frame.commands[i].sourceRect]) assert.equal(Object.isFrozen(value), true);
    }
    return { engine, frame, image, geometries, meshes, close };
  } catch (cause) { await close(); throw cause; }
}
async function genuine(geometries, run, options) {
  const f = await fixture(geometries, options);
  try { return await run(f); } finally { await f.close(); }
}
function assertAdmission(result, frame, geometryBytes) {
  assert.equal(result.frame, frame); assert.equal(result.width, 8); assert.equal(result.height, 8);
  assert.equal(result.uniqueGeometryBytes, geometryBytes);
  assert.equal(result.commands.length, frame.commands.length);
  result.commands.forEach((record, i) => {
    assert.equal(record.command, frame.commands[i]); assert.equal(record.commandIndex, i);
    if (record.command.kind !== 'rect') assert.equal(record.image, frame.images[record.command.imageIndex]);
    if (record.command.kind === 'mesh') assert.equal(record.geometry, frame.geometries[record.command.geometryIndex]);
  });
}
function unitWithMesh(geometry = ownedGeometry(), command = meshCommand(), image = ownedImage()) {
  return unitFrame({ commands: Object.freeze([command]), images: Object.freeze([image]), geometries: Object.freeze([geometry]) });
}

test('P01 trusted textured admission exists after genuine public Engine resource Mesh capture', async () => {
  // Required future RED runs only this named case, after all setup above succeeds.
  await genuine([ownedGeometry()], async f => {
    assert.equal(f.geometries[0].logicalByteLength, 204);
    assert.deepEqual(f.geometries[0].positions, [2, 2, 6, 2, 2, 6]);
    assert.deepEqual(f.geometries[0].indices, [0, 1, 2]);
    assert.equal(typeof TexturedPreparationBudget2D, 'function');
    const admit = admission(), budget = ledger();
    const result = admit(f.frame, FRAME_OPTIONS, budget);
    assertAdmission(result, f.frame, ORACLE.triangleGeometryBytes);
    assert.equal(budget.snapshot().sourceTrianglesCharged, 1);
    assert.equal(budget.snapshot().preparedVerticesCharged, 0);
    assert.equal(budget.snapshot().predicatesCharged, 0);
  });
});

test('P02 PRIVATE UNIT header backing precede all length/index work', () => {
  const log = [], commands = lengthUnit(65537, 'commands', log);
  reason(() => admission()(unitFrame({ profile: 'wrong', commands }), FRAME_OPTIONS, ledger()), 'invalid');
  assert.deepEqual(log, []);
  reason(() => admission()(unitFrame({ width: 4097, height: 4097, commands }), FRAME_OPTIONS, ledger()), 'backing');
  assert.deepEqual(log, []);
  reason(() => admission()(unitFrame({ width: Number.MAX_VALUE, commands }), FRAME_OPTIONS, ledger()), 'backing');
  assert.deepEqual(log, []);
});

test('P02 backing limits precede nominal DPR geometry range after genuine public capture', async () => {
  await genuine([ownedGeometry()], async f => {
    for (const pixelRatio of [2 ** 21, Number.MAX_VALUE]) {
      const budget = ledger();
      reason(() => admission()(f.frame, { ...FRAME_OPTIONS, pixelRatio }, budget), 'backing');
      assert.equal(budget.snapshot().sourceTrianglesCharged, 0);
      assert.equal(budget.snapshot().predicatesCharged, 0);
    }
  });
  const log = [], commands = lengthUnit(65537, 'commands', log);
  for (const pixelRatio of [2 ** 21, Number.MAX_VALUE]) {
    reason(() => admission()(unitFrame({ commands }), { ...FRAME_OPTIONS, pixelRatio }, ledger()), 'backing');
    assert.deepEqual(log, []);
  }
  // Small logical dimensions admit backing first; a length refusal still precedes preparation.
  reason(() => admission()(unitFrame({ width: 2 ** -21, height: 2 ** -21, commands }),
    { ...FRAME_OPTIONS, pixelRatio: 2 ** 21 }, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length']);
});

test('P02 PRIVATE UNIT command image geometry lengths precede indexed entries in exact order', () => {
  const log = [];
  const commands = lengthUnit(65537, 'commands', log), images = lengthUnit(65, 'images', log), geometries = lengthUnit(129, 'geometries', log);
  reason(() => admission()(unitFrame({ commands, images, geometries }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length']);
  log.length = 0;
  reason(() => admission()(unitFrame({ commands: lengthUnit(1, 'commands', log), images, geometries }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length', 'images.length']);
  log.length = 0;
  reason(() => admission()(unitFrame({ commands: lengthUnit(1, 'commands', log), images: lengthUnit(0, 'images', log), geometries }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length', 'images.length', 'geometries.length']);
});

for (const value of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test('P02 PRIVATE UNIT invalid command length ' + String(value) + ' precedes entries', () => {
    const log = [];
    reason(() => admission()(unitFrame({ commands: lengthUnit(value, 'commands', log) }), FRAME_OPTIONS, ledger()), 'invalid');
    assert.deepEqual(log, ['commands.length']);
  });
}

test('P02 PRIVATE UNIT geometry authentication precedes image authentication and commands', () => {
  const log = [], forgedGeometry = new Proxy({}, { get() { log.push('forged geometry property'); throw new Error('geometry poison'); } });
  const forgedImage = new Proxy({}, { get() { log.push('forged image property'); throw new Error('image poison'); } });
  const commands = lengthUnit(1, 'commands', log);
  reason(() => admission()(unitFrame({ commands, images: [forgedImage], geometries: [forgedGeometry] }), FRAME_OPTIONS, ledger()), 'invalid');
  assert.deepEqual(log, ['commands.length']);
  log.length = 0;
  reason(() => admission()(unitFrame({ commands, images: [forgedImage], geometries: [ownedGeometry()] }), FRAME_OPTIONS, ledger()), 'invalid');
  assert.deepEqual(log, ['commands.length']);
});

test('P02 PRIVATE UNIT geometry byte budget outranks image and command poison', () => {
  const log = [];
  reason(() => admission()(unitFrame({ commands: lengthUnit(1, 'commands', log), images: lengthUnit(1, 'images', log),
    geometries: [ownedGeometry()] }), { ...FRAME_OPTIONS, maxFrameGeometryBytes: 203 }, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length', 'images.length']);
});

test('P02 PRIVATE UNIT whole source debit rejects before matrix or any triangle payload', () => {
  const geometry = ownedGeometry(2), log = [], command = { ...meshCommand() };
  Object.defineProperty(command, 'matrix', { get() { log.push('matrix'); throw new Error('matrix poison'); } });
  const budget = ledger(1);
  reason(() => admission()(unitWithMesh(geometry, command), { ...FRAME_OPTIONS, maxSourceTriangles: 1 }, budget), 'budget');
  assert.deepEqual(log, []); assert.equal(budget.snapshot().sourceTrianglesCharged, 0);
  // Genuine geometry is frozen and cannot expose poisoned indices. No fake identity is accepted.
});

test('P02 PRIVATE UNIT painter source occurrences charge once each before later matrix fault', () => {
  const geometry = ownedGeometry(), image = ownedImage(), log = [], second = { ...meshCommand() };
  Object.defineProperty(second, 'matrix', { get() { log.push('second matrix'); throw new Error('matrix poison'); } });
  const budget = ledger(1), frame = unitFrame({ commands: [meshCommand(), second], images: [image], geometries: [geometry] });
  reason(() => admission()(frame, { ...FRAME_OPTIONS, maxSourceTriangles: 1 }, budget), 'budget');
  assert.deepEqual(log, []); assert.equal(budget.snapshot().sourceTrianglesCharged, 1);
});

test('P02 PRIVATE UNIT clip whole length debit precedes first clip and degeneracy work', () => {
  const log = [], budget = ledger();
  const frame = unitWithMesh(ownedGeometry(), meshCommand({ alpha: 0, clips: lengthUnit(2, 'clips', log) }));
  reason(() => admission()(frame, { ...FRAME_OPTIONS, maxClipRectangles: 1 }, budget), 'budget');
  assert.deepEqual(log, ['clips.length']); assert.equal(budget.snapshot().sourceTrianglesCharged, 1);
});

test('P02 PRIVATE UNIT all clips preflight even for zero alpha empty geometry', () => {
  const clips = [{ matrix: IDENTITY, rect: { x: 0, y: 0, width: 1, height: 1 } },
    { matrix: { ...IDENTITY, a: 2 ** 21 }, rect: { x: 0, y: 0, width: 1, height: 1 } }];
  reason(() => admission()(unitWithMesh(emptyGeometry(), meshCommand({ alpha: 0, clips })), FRAME_OPTIONS, ledger()), 'range');
});

test('P02 PRIVATE UNIT cumulative clip occurrences exact two then smallest over', () => {
  const clip = Object.freeze({ matrix: IDENTITY, rect: Object.freeze({ x: 0, y: 0, width: 8, height: 8 }) });
  const image = ownedImage(), geometry = ownedGeometry();
  const frame = unitFrame({ commands: [meshCommand({ clips: [clip] }), meshCommand({ clips: [clip] })], images: [image], geometries: [geometry] });
  const exactBudget = ledger();
  assertAdmission(admission()(frame, { ...FRAME_OPTIONS, maxClipRectangles: 2 }, exactBudget), frame, 204);
  reason(() => admission()(frame, { ...FRAME_OPTIONS, maxClipRectangles: 1 }, ledger()), 'budget');
});

test('P02 PRIVATE UNIT invalid kind alpha index crop are metadata faults', () => {
  for (const command of [meshCommand({ kind: 'unknown' }), meshCommand({ alpha: 1.01 }),
    meshCommand({ imageIndex: 1 }), meshCommand({ geometryIndex: 1 }),
    meshCommand({ sourceRect: { x: 1, y: 0, width: 1, height: 1 } })]) {
    reason(() => admission()(unitWithMesh(ownedGeometry(), command), FRAME_OPTIONS, ledger()), 'invalid');
  }
});

test('P03 genuine source cap one rejects two source triangles before later preparation range', async () => {
  const geometry = ownedGeometry(2, { positions: [2 ** 21, 2, 2 ** 21 + 4, 2, 2 ** 21, 6] });
  await genuine([geometry], async f => {
    const budget = ledger(1);
    reason(() => admission()(f.frame, { ...FRAME_OPTIONS, maxSourceTriangles: 1 }, budget), 'budget');
    assert.equal(budget.snapshot().sourceTrianglesCharged, 0);
    // Capture admitted these finite logical coordinates; range belongs to later preparation.
    assert.equal(f.frame.geometries[0], geometry);
    const exactBudget = ledger(2), admitted = admission()(f.frame, { ...FRAME_OPTIONS, maxSourceTriangles: 2 }, exactBudget);
    const drawsModule = await optionalExact(drawsURL);
    assert.equal(typeof drawsModule?.prepareTexturedDraws2D, 'function', 'accepted Task2 dispatcher prerequisite');
    reason(() => drawsModule.prepareTexturedDraws2D(admitted, PREPARATION_OPTIONS, exactBudget), 'range');
    assert.equal(exactBudget.snapshot().sourceTrianglesCharged, 2);
  });
});

test('P03 genuine exact two source admission and preparation never debit source twice', async () => {
  await genuine([ownedGeometry(2)], async f => {
    const budget = ledger(2), admitted = admission()(f.frame, { ...FRAME_OPTIONS, maxSourceTriangles: 2 }, budget);
    const module = await optionalExact(drawsURL);
    assert.equal(typeof module?.prepareTexturedDraws2D, 'function', 'accepted Task2 dispatcher prerequisite');
    const draws = module.prepareTexturedDraws2D(admitted, PREPARATION_OPTIONS, budget);
    assert.equal(draws.length, 1); assert.equal(draws[0].kind, 'mesh');
    assert.equal(draws[0].prepared.sourceTrianglesCharged, 2);
    assert.equal(budget.snapshot().sourceTrianglesCharged, 2);
    assert.equal(budget.snapshot().preparedVerticesCharged, 6);
  });
});

test('P03 genuine captured hard source cap lowered host 65535 rejects while 65536 admits', async () => {
  await genuine([ownedGeometry(65536)], async f => {
    reason(() => admission()(f.frame, { ...FRAME_OPTIONS, maxSourceTriangles: 65535 }, ledger(65535)), 'budget');
    const budget = ledger(); assertAdmission(admission()(f.frame, FRAME_OPTIONS, budget), f.frame, 786624);
    assert.equal(budget.snapshot().sourceTrianglesCharged, 65536);
  });
  // Two occurrences of this geometry cannot be captured. No public 65537 witness is claimed.
});

test('P03 genuine unused extreme vertex is retained without host admission rescan', async () => {
  const geometry = ownedGeometry(1, { vertexCount: 65536, unusedExtreme: true });
  await genuine([geometry], async f => {
    const budget = ledger(), admitted = admission()(f.frame, FRAME_OPTIONS, budget);
    assertAdmission(admitted, f.frame, 4194316);
    const module = await optionalExact(drawsURL);
    assert.equal(typeof module?.prepareTexturedDraws2D, 'function', 'accepted Task2 dispatcher prerequisite');
    const draws = module.prepareTexturedDraws2D(admitted, PREPARATION_OPTIONS, budget);
    assert.equal(draws[0].prepared.preparedVerticesCharged, 3);
    assert.equal(geometry.positions[131070], Number.MAX_VALUE);
  });
});

test('P03 genuine repeated geometry stores 204 once but source work charges every command', async () => {
  const geometry = ownedGeometry();
  await genuine([geometry, geometry], async f => {
    assert.equal(f.frame.geometries.length, 1);
    const budget = ledger(2), result = admission()(f.frame, { ...FRAME_OPTIONS, maxSourceTriangles: 2, maxFrameGeometryBytes: 204 }, budget);
    assertAdmission(result, f.frame, 204); assert.equal(budget.snapshot().sourceTrianglesCharged, 2);
    reason(() => admission()(f.frame, { ...FRAME_OPTIONS, maxFrameGeometryBytes: 203 }, ledger()), 'budget');
  });
});

test('P03 genuine distinct geometry bytes 408 exact and 407 reject before commands', async () => {
  await genuine([ownedGeometry(), ownedGeometry()], async f => {
    assertAdmission(admission()(f.frame, { ...FRAME_OPTIONS, maxFrameGeometryBytes: 408 }, ledger()), f.frame, 408);
    const budget = ledger(); reason(() => admission()(f.frame, { ...FRAME_OPTIONS, maxFrameGeometryBytes: 407 }, budget), 'budget');
    assert.equal(budget.snapshot().sourceTrianglesCharged, 0);
  });
});

test('P03 PRIVATE UNIT geometry table exact 128 authentic entries and 129 length refusal', () => {
  const geometries = Object.freeze(Array.from({ length: 128 }, () => emptyGeometry()));
  const frame = unitFrame({ geometries });
  assert.equal(admission()(frame, FRAME_OPTIONS, ledger()).uniqueGeometryBytes, 0);
  const log = [];
  reason(() => admission()(unitFrame({ geometries: lengthUnit(129, 'geometries', log) }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['geometries.length']);
});

test('P03 PRIVATE UNIT duplicate geometry table identities charge204 once', () => {
  const geometry = ownedGeometry(), frame = unitFrame({ geometries: new Array(128).fill(geometry) });
  assert.equal(admission()(frame, { ...FRAME_OPTIONS, maxFrameGeometryBytes: 204 }, ledger()).uniqueGeometryBytes, 204);
});

test('P03 PRIVATE UNIT source hard cap65537 rejects second command before matrix index poison', () => {
  const full = ownedGeometry(65536), one = ownedGeometry(), image = ownedImage(), log = [];
  const last = { ...meshCommand({ geometryIndex: 1 }) };
  Object.defineProperty(last, 'matrix', { get() { log.push('second matrix'); throw new Error('matrix poison'); } });
  const budget = ledger(), frame = unitFrame({ commands: [meshCommand(), last], images: [image], geometries: [full, one] });
  reason(() => admission()(frame, FRAME_OPTIONS, budget), 'budget');
  assert.equal(budget.snapshot().sourceTrianglesCharged, 65536); assert.deepEqual(log, []);
});

test('P03 genuine geometry bytes hard exact16777216 and PRIVATE UNIT smallest over16777220', async () => {
  const first = ownedGeometry(1, { vertexCount: 65536 }), second = ownedGeometry(1, { vertexCount: 65536 }),
    third = ownedGeometry(1, { vertexCount: 65536 }), exactLast = ownedGeometry(13, { vertexCount: 65533 }),
    overLast = ownedGeometry(8, { vertexCount: 65534 });
  assert.deepEqual([first.logicalByteLength, second.logicalByteLength, third.logicalByteLength, exactLast.logicalByteLength],
    [4194316, 4194316, 4194316, 4194268]);
  await genuine([first, second, third, exactLast], async f => {
    assertAdmission(admission()(f.frame, FRAME_OPTIONS, ledger()), f.frame, 16777216);
  });
  const log = [], budget = ledger();
  reason(() => admission()(unitFrame({ commands: lengthUnit(1, 'commands', log),
    geometries: [first, second, third, overLast] }), FRAME_OPTIONS, budget), 'budget');
  assert.equal(budget.snapshot().sourceTrianglesCharged, 0); assert.deepEqual(log, ['commands.length']);
  // Canonical logical bytes are multiples of4, so byte+4 is the smallest reachable excess.
});

test('P03 PRIVATE UNIT command hard exact65536 and cumulative clip exact262144 then262145', () => {
  const clip = Object.freeze({ matrix: IDENTITY, rect: Object.freeze({ x: 0, y: 0, width: 8, height: 8 }) });
  const command = rectCommand({ clips: Object.freeze([clip, clip, clip, clip]) });
  const commands = new Array(65536).fill(command), frame = unitFrame({ commands });
  assert.equal(admission()(frame, FRAME_OPTIONS, ledger()).commands.length, 65536);
  const smallestOver = commands.slice(); smallestOver[65535] = rectCommand({ clips: [clip, clip, clip, clip, clip] });
  reason(() => admission()(unitFrame({ commands: smallestOver }), FRAME_OPTIONS, ledger()), 'budget');
  reason(() => admission()(unitFrame({ commands: [rectCommand(), rectCommand()] }), { ...FRAME_OPTIONS, maxCommands: 1 }, ledger()), 'budget');
});

test('P03 PRIVATE UNIT image identity duplicates table bytes once and 65 length refusal', () => {
  const image = ownedImage(), images = Object.freeze(new Array(64).fill(image));
  assert.equal(admission()(unitFrame({ images }), FRAME_OPTIONS, ledger()).uniqueGeometryBytes, 0);
  const log = [];
  reason(() => admission()(unitFrame({ images: lengthUnit(65, 'images', log) }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['images.length']);
});

test('P03 PRIVATE UNIT image table 16777216 exact and 16777220 before command poison', () => {
  const images = Array.from({ length: 4 }, () => ownedImage(1024, 1024));
  assert.equal(images.reduce((sum, image) => sum + image.byteLength, 0), 16777216);
  admission()(unitFrame({ images }), FRAME_OPTIONS, ledger());
  const log = [];
  reason(() => admission()(unitFrame({ images: [...images, ownedImage()], commands: lengthUnit(1, 'commands', log) }), FRAME_OPTIONS, ledger()), 'budget');
  assert.deepEqual(log, ['commands.length']);
});

test('P03 trusted projection facade deduplicates same identity crop including zero output', () => {
  const image = ownedImage(2, 2), crop = Object.freeze({ x: 1, y: 1, width: 1, height: 1 });
  const frame = unitFrame({ images: [image], geometries: [emptyGeometry()], commands: [rectCommand(),
    imageCommand({ sourceRect: crop }), meshCommand({ sourceRect: crop, alpha: 0 }),
    imageCommand({ sourceRect: { x: 0, y: 0, width: 1, height: 1 } })] });
  const plan = projections(frame);
  assert.deepEqual(plan.commandViews, [undefined, 0, 0, 1]);
  assert.equal(plan.views.length, 2); assert.equal(plan.projectionBytes, 8); assert.equal(plan.scratchBytes, 24);
  assert.equal(plan.views[0].image, image); assert.equal(plan.views[0].region, crop);
  assert.equal(Object.isFrozen(plan), true); assert.equal(Object.isFrozen(plan.commandViews), true);
});

test('P03 trusted projection exact 128 crops admits and 129 rejects with deliberate observer identity', () => {
  const image = ownedImage(129, 1);
  const commands = Array.from({ length: 128 }, (_unused, x) => meshCommand({ sourceRect: { x, y: 0, width: 1, height: 1 } }));
  const frame = unitFrame({ images: [image], geometries: [emptyGeometry()], commands });
  const exact = projections(frame); assert.equal(exact.views.length, 128); assert.equal(exact.projectionBytes, 512);
  let observed;
  assert.throws(() => projections(unitFrame({ ...frame, commands: [...commands, meshCommand({ sourceRect: { x: 128, y: 0, width: 1, height: 1 } })] }), value => { observed = value; }),
    cause => cause === observed && cause.reason === 'budget');
});

test('P03 shared legacy projection facade retains modes observer authority and literal premultiply', () => {
  const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 32, 8, 128]) });
  const legacy = { commands: [imageCommand()], images: [image] };
  const straight = projectionModule.planImageProjections(legacy, 'straight');
  const premultiplied = projectionModule.planImageProjections(legacy, 'premultiplied');
  assert.equal(straight.scratchBytes, 12); assert.equal(premultiplied.scratchBytes, 8);
  assert.deepEqual(Array.from(projectionModule.copyProjectionPixels(straight.views[0], 'straight')), [255, 32, 8, 128]);
  assert.deepEqual(Array.from(projectionModule.copyProjectionPixels(premultiplied.views[0], 'premultiplied')), [128, 16, 4, 128]);
  assert.deepEqual(projectionModule.planImageProjections({ commands: [rectCommand()] }, 'premultiplied').commandViews, [undefined]);
  let observed;
  assert.throws(() => projectionModule.planImageProjections({ commands: [imageCommand()] }, 'premultiplied', failure => { observed = failure; }),
    cause => cause === observed && cause.reason === 'invalid');
  const sentinel = new egret.EgretError('WEBGPU_FRAME_BUDGET');
  assert.throws(() => projectionModule.planImageProjections({ commands: [imageCommand()] }, 'premultiplied', () => { throw sentinel; }), cause => cause === sentinel);
});

// All records below are PRIVATE prepared/storage units, not public-authentic frames.
// The proposed helper must also be consumed unchanged by the real new preflight.
function privateMeshPrepared(count = 3, overrides = {}) {
  return { polygons: [], sourceTrianglesCharged: count / 3, preparedVerticesCharged: count,
    counters: ZERO_COUNTERS, ...overrides };
}
function storageInput({ width = 8, height = 8, geometryBytes = 204, projectionWidth = 1,
  commands, draws = [{ kind: 'mesh', commandIndex: 0, prepared: privateMeshPrepared() }] } = {}) {
  const image = ownedImage(projectionWidth, 1);
  const command = meshCommand({ sourceRect: { x: 0, y: 0, width: projectionWidth, height: 1 } });
  const frameCommands = commands ?? Array.from({ length: Math.max(1, ...draws.map(draw => (draw.commandIndex ?? -1) + 1)) }, () => command);
  const geometry = ownedGeometry();
  const frame = unitFrame({ width, height, commands: frameCommands, images: [image], geometries: [geometry] });
  const admitted = { frame, width, height, uniqueGeometryBytes: geometryBytes,
    commands: frameCommands.map((value, commandIndex) => ({ command: value, commandIndex,
      ...(value.kind === 'rect' ? {} : { image }), ...(value.kind === 'mesh' ? { geometry } : {}) })) };
  const projectionPlan = { views: [{ image, region: command.sourceRect, byteLength: 4 * projectionWidth }],
    commandViews: frameCommands.map(value => value.kind === 'rect' ? undefined : 0),
    projectionBytes: 4 * projectionWidth, scratchBytes: 8 * projectionWidth };
  return { admitted, draws, projectionPlan };
}
function privateOperations(log, { collapsed = false, throwPack, onPack } = {}) {
  return Object.freeze({
    pack(draw, width, height, bytes, budget) {
      log.push('pack:' + draw.kind + ':' + bytes); onPack?.();
      if (throwPack !== undefined) throw throwPack;
      assert.equal(width, 8); assert.equal(height, 8); assert.equal(typeof budget.admitPredicate, 'function');
      const stride = draw.kind === 'rect' ? 24 : draw.kind === 'image' ? 16 : 32;
      return { data: new Float32Array(collapsed ? 0 : bytes / 4), vertexCount: collapsed ? 0 : bytes / stride };
    },
    copy(view) { log.push('copy:' + view.byteLength); return new Uint8Array(view.byteLength); },
    uniform(alpha) { log.push('uniform:' + alpha); return new Float32Array([alpha, 0, 0, 0]); },
  });
}
function request(overrides = {}) {
  return { ...storageInput(), options: STORAGE_OPTIONS, hardware: HARDWARE,
    owner: OWNER, readback: false, ...overrides };
}
function privateFailure(module, run, expectedReason, facet) {
  assert.throws(run, cause => module.isTexturedSubmissionAdmissionError2D(cause)
    && cause.reason === expectedReason && (facet === undefined || cause.facet === facet));
}

test('P04 PRIVATE UNIT upload 111 rejects before any payload operation even with hardware 95', async () => {
  const module = await submission(), log = [], operations = privateOperations(log);
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ options: { ...STORAGE_OPTIONS, maxUploadBytes: 111 },
    hardware: { ...HARDWARE, maxBufferSize: 95 } }), ledger(), () => OWNER, operations), 'budget', 'upload');
  assert.deepEqual(log, []);
});

test('P04 PRIVATE UNIT upload 112 admits then vertex device 95 rejects before payload', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ options: { ...STORAGE_OPTIONS, maxUploadBytes: 112 },
    hardware: { ...HARDWARE, maxBufferSize: 95 } }), ledger(), () => OWNER, privateOperations(log)), 'device', 'buffer');
  assert.deepEqual(log, []);
});

test('P04 PRIVATE UNIT exact 112 and device96 admit vertex96 plus uniform16', async () => {
  const module = await submission(), log = [], q = request({ options: { ...STORAGE_OPTIONS, maxUploadBytes: 112 }, hardware: { ...HARDWARE, maxBufferSize: 96 } });
  const storage = module.planTexturedSubmissionStorage2D(q);
  assert.equal(storage.upload, 112); assert.equal(storage.geometryBytes, 204);
  assert.deepEqual(storage.drawStorage, [{ vertexBytes: 96, uniformBytes: 16 }]);
  const plan = module.prepareTexturedSubmission2D(q, ledger(), () => { log.push('owner-recheck'); return OWNER; }, privateOperations(log));
  assert.equal(plan.frame, q.admitted.frame); assert.equal(plan.upload, 112);
  assert.equal(plan.draws[0].packed.vertexCount, 3); assert.equal(plan.draws[0].uniform.byteLength, 16);
  assert.deepEqual(log, ['pack:mesh:96', 'copy:4', 'uniform:1', 'owner-recheck']);
  assert.equal(plan.scene, undefined);
});

test('P04 PRIVATE UNIT packed collapse retains 112 geometry204 projection4 without uniform', async () => {
  const module = await submission(), log = [];
  const plan = module.prepareTexturedSubmission2D(request(), ledger(), () => OWNER, privateOperations(log, { collapsed: true }));
  assert.equal(plan.upload, 112); assert.equal(plan.geometryBytes, 204); assert.equal(plan.projectionPlan.projectionBytes, 4);
  assert.equal(plan.draws[0].packed.vertexCount, 0); assert.equal(plan.draws[0].uniform, undefined);
  assert.deepEqual(log, ['pack:mesh:96', 'copy:4']);
});

test('P04 PRIVATE UNIT uniforms count once per prepared command instead of once per triangle', async () => {
  const module = await submission();
  assert.equal(module.planTexturedSubmissionStorage2D(request({ ...storageInput({ draws: [{ kind: 'mesh', commandIndex: 0,
    prepared: privateMeshPrepared(6) }] }) })).upload, 208);
  assert.equal(module.planTexturedSubmissionStorage2D(request({ ...storageInput({ draws: [
    { kind: 'mesh', commandIndex: 0, prepared: privateMeshPrepared(3) },
    { kind: 'mesh', commandIndex: 1, prepared: privateMeshPrepared(3) }] }) })).upload, 224);
});

test('P04 PRIVATE UNIT mixed rectangle image mesh upper bound is exactly368', async () => {
  const module = await submission();
  const rect = { points: [], commands: [{ pointIndices: [0, 1, 2, 3], color: 0, alpha: 1 }], edgeTests: 0 };
  const image = { points: [{}, {}, {}, {}], pointIndices: [0, 1, 2, 3], imageIndex: 0,
    sourceRect: { x: 0, y: 0, width: 1, height: 1 }, alpha: 1, edgeTests: 0 };
  const draws = [{ kind: 'rect', prepared: rect }, { kind: 'image', commandIndex: 1, prepared: image },
    { kind: 'mesh', commandIndex: 2, prepared: privateMeshPrepared() }];
  const storage = module.planTexturedSubmissionStorage2D(request({ ...storageInput({ draws,
    commands: [rectCommand(), imageCommand(), meshCommand()] }) }));
  assert.equal(storage.upload, ORACLE.mixedQuadQuadTriangleUploadBytes);
  assert.deepEqual(storage.drawStorage, [{ vertexBytes: 144, uniformBytes: 0 }, { vertexBytes: 96, uniformBytes: 16 }, { vertexBytes: 96, uniformBytes: 16 }]);
});

test('P04 PRIVATE UNIT unsafe prepared-byte multiplication rejects without payload', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ ...storageInput({ draws: [
    { kind: 'mesh', commandIndex: 0, prepared: privateMeshPrepared(Number.MAX_SAFE_INTEGER) }] }) }), ledger(), () => OWNER, privateOperations(log)), 'budget', 'upload');
  assert.deepEqual(log, []);
});

test('P04 genuine thin mesh uses real Task2 packer and retains collapse upper admission', async () => {
  await genuine([ownedGeometry(1, { positions: [1, 1, 9, 1, 1, 1 + 2 ** -40] })], async f => {
    const module = await submission(), drawsModule = await optionalExact(drawsURL), budget = ledger();
    assert.equal(typeof drawsModule?.prepareTexturedDraws2D, 'function', 'accepted Task2 dispatcher prerequisite');
    const admitted = admission()(f.frame, FRAME_OPTIONS, budget);
    const draws = drawsModule.prepareTexturedDraws2D(admitted, PREPARATION_OPTIONS, budget);
    // This genuine capture is width16, keeping all three backing vertices inside.
    assert.equal(draws[0].kind, 'mesh');
    const plan = module.prepareTexturedSubmission2D({ admitted, draws, projectionPlan: projections(f.frame),
      options: STORAGE_OPTIONS, hardware: HARDWARE, owner: OWNER, readback: false }, budget, () => OWNER);
    assert.equal(plan.upload, 112); assert.equal(plan.geometryBytes, 204);
    assert.equal(plan.draws[0].packed.vertexCount, 0); assert.equal(plan.draws[0].packed.counters.packedCollapsedTriangles, 1);
    assert.equal(plan.draws[0].uniform, undefined); assert.equal(plan.projections[0].byteLength, 4);
  }, { dimensions: { width: 16, height: 8 } });
});

test('P05 PRIVATE UNIT backing device dimensions reject before payload operations', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ hardware: { ...HARDWARE, maxTextureDimension2D: 7 } }),
    ledger(), () => OWNER, privateOperations(log)), 'device', 'texture');
  assert.deepEqual(log, []);
});

test('P05 PRIVATE UNIT undrawn crop device dimensions are still admitted before payload', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ ...storageInput({ projectionWidth: 9,
    draws: [{ kind: 'mesh', commandIndex: 0, prepared: privateMeshPrepared(0) }] }), hardware: { ...HARDWARE, maxTextureDimension2D: 8 } }),
    ledger(), () => OWNER, privateOperations(log)), 'device', 'texture');
  assert.deepEqual(log, []);
});

test('P05 PRIVATE UNIT readback2303 rejects before payload even with lower device staging cap', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ readback: true,
    options: { ...STORAGE_OPTIONS, maxReadbackBytes: 2303 }, hardware: { ...HARDWARE, maxBufferSize: 2047 } }),
    ledger(), () => OWNER, privateOperations(log)), 'budget', 'readback');
  assert.deepEqual(log, []);
});

test('P05 PRIVATE UNIT readback2304 exact then device staging2047 refuses', async () => {
  const module = await submission(), q = request({ readback: true, options: { ...STORAGE_OPTIONS, maxReadbackBytes: 2304 } });
  const storage = module.planTexturedSubmissionStorage2D(q);
  assert.deepEqual([storage.rowPitch, storage.staging, storage.output], [256, 2048, 256]);
  const log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D({ ...q, hardware: { ...HARDWARE, maxBufferSize: 2047 } },
    ledger(), () => OWNER, privateOperations(log)), 'device', 'readback');
  assert.deepEqual(log, []);
});

for (const facet of ['frames', 'upload', 'readback', 'texture', 'geometry']) {
  test('P05 PRIVATE UNIT first capacity refusal ' + facet + ' precedes every later capacity and serial', async () => {
    const module = await submission(), log = [];
    // Each row leaves earlier counters admitted and poisons this and ALL later capacity predicates.
    const order = ['frames', 'upload', 'readback', 'texture', 'geometry'], index = order.indexOf(facet);
    const owner = { ...OWNER, serial: Number.MAX_SAFE_INTEGER };
    if (index <= 0) owner.pendingFrames = 2;
    if (index <= 1) owner.pendingUploadBytes = 67108864;
    if (index <= 2) owner.pendingReadbackBytes = 67108864;
    if (index <= 3) owner.pendingTextureBytes = 33554432;
    if (index <= 4) owner.pendingGeometryBytes = 33554432;
    privateFailure(module, () => module.prepareTexturedSubmission2D(request({ owner, readback: true }),
      ledger(), () => OWNER, privateOperations(log)), 'backpressure', facet);
    assert.deepEqual(log, []); assert.deepEqual(OWNER, { pendingFrames: 0, pendingUploadBytes: 0,
      pendingReadbackBytes: 0, pendingTextureBytes: 0, pendingGeometryBytes: 0, serial: 0 });
  });
}

test('P05 PRIVATE UNIT serial exhausted only after admitted capacities before payload', async () => {
  const module = await submission(), log = [];
  privateFailure(module, () => module.prepareTexturedSubmission2D(request({ owner: { ...OWNER, serial: Number.MAX_SAFE_INTEGER } }),
    ledger(), () => OWNER, privateOperations(log)), 'serial', 'serial');
  assert.deepEqual(log, []);
  assert.equal(module.planTexturedSubmissionStorage2D(request({ owner: { ...OWNER, serial: Number.MAX_SAFE_INTEGER - 1 } })).upload, 112);
});

test('P05 PRIVATE UNIT exact frame upload readback texture geometry remaining capacity admits', async () => {
  const module = await submission();
  const owner = { ...OWNER, pendingFrames: 1, pendingUploadBytes: 67108864 - 112,
    pendingReadbackBytes: 67108864 - 2304, pendingTextureBytes: 33554432 - 4,
    pendingGeometryBytes: 33554432 - 204 };
  const storage = module.planTexturedSubmissionStorage2D(request({ owner, readback: true }));
  assert.equal(storage.upload, 112); assert.equal(storage.geometryBytes, 204); assert.equal(storage.staging + storage.output, 2304);
});

for (const facet of ['frames', 'upload', 'readback', 'texture', 'geometry']) {
  test('P05 PRIVATE UNIT post-copy capacity recheck ' + facet + ' uses same ordered predicates', async () => {
    const module = await submission(), log = [], order = ['frames', 'upload', 'readback', 'texture', 'geometry'], index = order.indexOf(facet);
    const later = { ...OWNER };
    if (index <= 0) later.pendingFrames = 2;
    if (index <= 1) later.pendingUploadBytes = 67108864;
    if (index <= 2) later.pendingReadbackBytes = 67108864;
    if (index <= 3) later.pendingTextureBytes = 33554432;
    if (index <= 4) later.pendingGeometryBytes = 33554432;
    privateFailure(module, () => module.prepareTexturedSubmission2D(request({ readback: true }), ledger(),
      () => { log.push('owner-recheck'); return later; }, privateOperations(log)), 'backpressure', facet);
    assert.deepEqual(log, ['pack:mesh:96', 'copy:4', 'uniform:1', 'owner-recheck']);
  });
}

test('P05 PRIVATE UNIT owner stopping on successful allocation boundary outranks capacity', async () => {
  const module = await submission(), log = [], terminal = new egret.EgretError('WEBGPU_STOPPED');
  assert.throws(() => module.prepareTexturedSubmission2D(request(), ledger(), () => { log.push('owner-recheck'); throw terminal; },
    privateOperations(log)), cause => cause === terminal && !module.isTexturedSubmissionAdmissionError2D(cause));
  assert.deepEqual(log, ['pack:mesh:96', 'copy:4', 'uniform:1', 'owner-recheck']);
});

test('P05 PRIVATE UNIT caller/native matching code or reason never gets private admission origin', async () => {
  const module = await submission();
  for (const sentinel of [new egret.EgretError('WEBGPU_FRAME_BUDGET'), Object.assign(new Error('native allocation'), { reason: 'budget' })]) {
    const log = [];
    assert.throws(() => module.prepareTexturedSubmission2D(request(), ledger(), () => OWNER,
      privateOperations(log, { throwPack: sentinel })), cause => cause === sentinel && !module.isTexturedSubmissionAdmissionError2D(cause));
    assert.deepEqual(log, ['pack:mesh:96']);
  }
  // A simultaneous stopping+throw, real target/GPU calls, ticket binding, serial
  // mutation and reservations are REQUIRED later public Task4 controls, not proved here.
});

async function originScope() {
  const module = await optionalExact(originURL);
  assert.equal(typeof module?.runOwnedPreparationScope, 'function', 'private per-invocation origin scope prerequisite');
  assert.equal(typeof module?.noteOwnedPreparationFailure, 'function', 'private first-party fail-site note prerequisite');
  return module;
}
function thrown(operation) {
  try { operation(); return { didThrow: false, value: undefined }; }
  catch (value) { return { didThrow: true, value }; }
}

test('P05 PRIVATE UNIT origin scope reports only a deliberate failure created in this invocation', async () => {
  const scope = await originScope(), observations = [];
  const result = thrown(() => scope.runOwnedPreparationScope(() => coordinate(2 ** 21), failure => observations.push(failure)));
  assert.equal(result.didThrow, true); assert.equal(result.value instanceof GeometryPreparationError, true);
  assert.equal(result.value.reason, 'range'); assert.deepEqual(observations, [result.value]);
});

test('P05 PRIVATE UNIT earlier owned failure replay is foreign in the next invocation', async () => {
  const scope = await originScope(), first = [];
  const previous = thrown(() => scope.runOwnedPreparationScope(() => coordinate(2 ** 21), value => first.push(value)));
  assert.deepEqual(first, [previous.value]);
  const second = [], replay = thrown(() => scope.runOwnedPreparationScope(() => { throw previous.value; }, value => second.push(value)));
  assert.equal(replay.value, previous.value); assert.deepEqual(second, []);
  const outside = thrown(() => coordinate(2 ** 21)), third = [];
  const outsideReplay = thrown(() => scope.runOwnedPreparationScope(() => { throw outside.value; }, value => third.push(value)));
  assert.equal(outsideReplay.value, outside.value); assert.deepEqual(third, []);
});

test('P05 PRIVATE UNIT constructed matching helper error public code and thrown undefined remain foreign', async () => {
  const scope = await originScope();
  for (const foreign of [new GeometryPreparationError('budget'), new egret.EgretError('WEBGPU_FRAME_BUDGET'), undefined]) {
    const observations = [], result = thrown(() => scope.runOwnedPreparationScope(() => { throw foreign; }, value => observations.push(value)));
    assert.equal(result.didThrow, true); assert.equal(result.value, foreign); assert.deepEqual(observations, []);
  }
});

test('P05 PRIVATE UNIT nested invocation restores parent while retaining separate error identity', async () => {
  const scope = await originScope(), inner = [], outer = [];
  const result = thrown(() => scope.runOwnedPreparationScope(() => {
    const child = thrown(() => scope.runOwnedPreparationScope(() => coordinate(2 ** 21), value => inner.push(value)));
    assert.equal(child.didThrow, true);
    coordinate(2 ** 22);
  }, value => outer.push(value)));
  assert.equal(result.didThrow, true); assert.equal(inner.length, 1); assert.deepEqual(outer, [result.value]);
  assert.notEqual(inner[0], result.value);
  const escaped = [], replay = thrown(() => scope.runOwnedPreparationScope(() => {
    scope.runOwnedPreparationScope(() => coordinate(2 ** 21), () => {});
  }, value => escaped.push(value)));
  assert.equal(replay.didThrow, true); assert.deepEqual(escaped, []);
});

test('P05 PRIVATE UNIT real mesh fround foreign GeometryPreparationError is never a deliberate budget refusal', async () => {
  const scope = await originScope(), packer = await optionalExact(meshPackerURL);
  assert.equal(typeof packer?.packTexturedMesh2D, 'function', 'accepted Task2 real mesh packer prerequisite');
  const points = [[2, 2], [6, 2], [2, 6]].map(([x, y]) => ({ x, y, u: 0, v: 0, r: 1, g: 1, b: 1, a: 1 }));
  const prepared = privateMeshPrepared(3, { polygons: [points] });
  const descriptor = Object.getOwnPropertyDescriptor(Math, 'fround'), foreign = new GeometryPreparationError('budget'), observations = [];
  let result;
  try {
    Object.defineProperty(Math, 'fround', { ...descriptor, value() { throw foreign; } });
    result = thrown(() => scope.runOwnedPreparationScope(() => packer.packTexturedMesh2D(prepared, 8, 8, 96, ledger()), value => observations.push(value)));
  } finally { Object.defineProperty(Math, 'fround', descriptor); }
  assert.equal(result.didThrow, true); assert.equal(result.value, foreign); assert.deepEqual(observations, []);
});

test('P05 PRIVATE UNIT real typed-allocation wrapper is current owned origin and keeps exact original cause', async () => {
  const scope = await originScope(), packer = await optionalExact(meshPackerURL);
  assert.equal(typeof packer?.packTexturedMesh2D, 'function', 'accepted Task2 real mesh packer prerequisite');
  const points = [[2, 2], [6, 2], [2, 6]].map(([x, y]) => ({ x, y, u: 0, v: 0, r: 1, g: 1, b: 1, a: 1 }));
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Float32Array'), foreign = new egret.EgretError('WEBGPU_FRAME_BUDGET'), observations = [];
  let result;
  try {
    Object.defineProperty(globalThis, 'Float32Array', { ...descriptor, value: function () { throw foreign; } });
    result = thrown(() => scope.runOwnedPreparationScope(() => packer.packTexturedMesh2D(privateMeshPrepared(3, { polygons: [points] }), 8, 8, 96, ledger()), value => observations.push(value)));
  } finally { Object.defineProperty(globalThis, 'Float32Array', descriptor); }
  assert.equal(result.didThrow, true); assert.equal(result.value instanceof packer.TexturedMeshPackingAllocationError, true);
  assert.equal(result.value.original, foreign); assert.deepEqual(observations, [result.value]);
  const replayObservations = [], replay = thrown(() => scope.runOwnedPreparationScope(() => { throw result.value; }, value => replayObservations.push(value)));
  assert.equal(replay.value, result.value); assert.deepEqual(replayObservations, []);
});

test('P05 PRIVATE UNIT previous storage refusal thrown from a payload operation has no current origin', async () => {
  const scope = await originScope(), module = await submission(), observations = [];
  const previous = thrown(() => scope.runOwnedPreparationScope(() => module.planTexturedSubmissionStorage2D(request({
    options: { ...STORAGE_OPTIONS, maxUploadBytes: 111 } })), value => observations.push(value)));
  assert.equal(previous.didThrow, true); assert.deepEqual(observations, [previous.value]);
  const replayObserved = [], replay = thrown(() => scope.runOwnedPreparationScope(() => module.prepareTexturedSubmission2D(request(), ledger(), () => OWNER,
    privateOperations([], { throwPack: previous.value })), value => replayObserved.push(value)));
  assert.equal(replay.value, previous.value); assert.deepEqual(replayObserved, []);
});
