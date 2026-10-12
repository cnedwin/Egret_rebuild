// SPDX-License-Identifier: Apache-2.0
// Independent original acceptance input; the runner admits current clone inputs.
// Fixture literals come from hand derivation, never from candidate geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const oracle = JSON.parse(await readFile(new URL('fixtures/f1-oracle.json', root), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const file = name => new URL(`fixtures/${name}`, root);
const frameOptions = Object.freeze({ width: 64, height: 48, clearColor: 0, clearAlpha: 0 });
let sdk;
let helpers;

async function checkPin(pin, relative = false) {
  const bytes = await readFile(relative ? new URL(pin.path, root) : pin.path);
  assert.equal(bytes.length, pin.bytes, `INPUT_BYTES_CHANGED: ${pin.path}`);
  assert.equal(sha256(bytes), pin.sha256, `INPUT_SHA256_CHANGED: ${pin.path}`);
}

// Real file-backed application providers supply no fabricated SDK authority.
function providers(engine, controls = {}) {
  const textType = sdk.createAssetType('F1 original text', value => typeof value === 'string');
  const pageType = sdk.createAssetType('F1 original page', sdk.isTexture);
  const refs = Object.freeze({
    skeleton: sdk.createAssetRef(textType, 'egret-original-slide.spine.json'),
    atlas: sdk.createAssetRef(textType, 'egret-original-slide.atlas'),
    page: sdk.createAssetRef(pageType, 'egret-original-page.rgba'),
  });
  const loadedText = [], disposedText = [], loadedPages = [], disposedPages = [];
  const pageStarted = helpers.deferred(), pageDisposed = helpers.deferred();
  engine.assets.register(textType, {
    async load(ref, context) {
      assert.ok(ref.id === refs.skeleton.id || ref.id === refs.atlas.id);
      const bytes = await readFile(file(ref.id));
      assert.ok(bytes.length <= 65536, 'F1_HEADER_BYTE_CAP');
      if (context.signal.aborted) throw context.signal.reason;
      const text = bytes.toString('utf8');
      loadedText.push(text);
      return text;
    },
    dispose(value) { disposedText.push(value); },
  });
  engine.assets.register(pageType, {
    async load(ref, context) {
      assert.equal(ref.id, refs.page.id);
      const bytes = await readFile(file(ref.id));
      assert.equal(bytes.length, 1024, 'F1_RGBA_EXACT_BYTES');
      if (controls.pageError !== undefined) throw controls.pageError;
      const pixels = new Uint8Array(1024);
      pixels.set(bytes);
      const texture = sdk.createTexture(sdk.createImageData2D({
        width: 16, height: 16, pixels, format: 'rgba8unorm',
        colorSpace: 'srgb', alphaMode: 'straight', origin: 'top-left',
      }));
      loadedPages.push(texture);
      pageStarted.resolve({ texture, signal: context.signal });
      // The late-result case deliberately models a real provider ignoring abort.
      if (controls.pageGate !== undefined) await controls.pageGate.promise;
      return texture;
    },
    dispose(texture) {
      disposedPages.push(texture);
      controls.onPageDispose?.(texture);
      texture.dispose();
      pageDisposed.resolve(texture);
    },
  });
  return { refs, loadedText, disposedText, loadedPages, disposedPages, pageStarted, pageDisposed };
}

async function withEngine(run) {
  const frames = [];
  const h = helpers.host({
    texturedFrameProfile: sdk.TEXTURED_FRAME_PROFILE_2D,
    renderTexturedFrame(frame) { frames.push(frame); return undefined; },
  });
  const engine = await sdk.createEngineForProfile({ host: h.adapter }, sdk.TEXTURED_FRAME_PROFILE_2D);
  try { await run(engine, { ...h, frames }); }
  finally { await engine.dispose(); }
  assert.deepEqual(h.trace, ['start', 'stop', 'close']);
  assert.equal(h.timers.size, 0);
}

function leaves(instance) {
  assert.ok(instance.display instanceof sdk.DisplayObjectContainer);
  assert.equal(instance.display.numChildren, 2, 'F1_CONFIRMED_CORE_TWO_COMMAND_PROFILE');
  return [instance.display.getChildAt(0), instance.display.getChildAt(1)].map(mesh => {
    assert.ok(mesh instanceof sdk.Mesh2D, 'F1_GENUINE_MESH_REQUIRED');
    return mesh;
  });
}
function copyGeometry(geometry) {
  if (geometry === undefined) return undefined;
  return {
    positions: [...geometry.positions], uvs: [...geometry.uvs],
    lightColors: [...geometry.lightColors], indices: [...geometry.indices],
  };
}
function retained(instance) {
  return leaves(instance).map(mesh => ({ mesh, geometry: mesh.geometry, values: copyGeometry(mesh.geometry) }));
}
function unchanged(saved) {
  for (const item of saved) assert.deepEqual(copyGeometry(item.geometry), item.values);
}
function sameSlots(saved) {
  unchanged(saved);
  for (const item of saved) assert.equal(item.mesh.geometry, item.geometry);
}
function clockSnapshot(engine) {
  return { clock: engine.clock, elapsedSeconds: engine.clock.elapsedSeconds, tickId: engine.clock.tickId };
}
function unchangedClock(engine, snapshot) {
  assert.equal(engine.clock, snapshot.clock);
  assert.equal(engine.clock.elapsedSeconds, snapshot.elapsedSeconds, 'F1_NO_CLOCK_ADVANCE');
  assert.equal(engine.clock.tickId, snapshot.tickId, 'F1_NO_CLOCK_TICK');
}
function checkInstance(instance, time, page, positionTolerance) {
  assert.equal(instance.elapsedSeconds, time);
  assert.equal(instance.display.x, 24);
  assert.equal(instance.display.y, 24);
  const expected = oracle.frames.find(frame => frame.t === time);
  assert.ok(expected, 'F1_FIXED_FRAME_ORACLE_REQUIRED');
  const meshes = leaves(instance);
  for (let command = 0; command < meshes.length; command++) {
    const mesh = meshes[command], geometry = mesh.geometry;
    assert.ok(sdk.isTexturedGeometry2D(geometry), 'F1_FACTORY_OWNED_GEOMETRY');
    assert.ok(Object.isFrozen(geometry));
    for (const values of [geometry.positions, geometry.uvs, geometry.lightColors, geometry.indices]) assert.ok(Object.isFrozen(values));
    assert.equal(geometry.vertexCount, 4);
    assert.equal(geometry.indexCount, 6);
    assert.equal(geometry.triangleCount, 2);
    assert.ok(mesh.textureLease instanceof sdk.AssetLease);
    assert.equal(mesh.textureLease.value, page, 'F1_LIVE_SHARED_PAGE_ENTITLEMENT');
    assert.deepEqual(page.sourceRect, { x: 0, y: 0, width: 16, height: 16 });
    const quad = expected.quads[command], assignment = [];
    for (let vertex = 0; vertex < 4; vertex++) {
      const point = mesh.localToGlobal(geometry.positions[vertex * 2], geometry.positions[vertex * 2 + 1]);
      const matches = quad.corners.map(([x, y], corner) =>
        Math.abs(point.x - x) <= positionTolerance && Math.abs(point.y - y) <= positionTolerance ? corner : -1).filter(corner => corner >= 0);
      assert.equal(matches.length, 1, 'F1_CORNER_BIJECTION_NO_NEAREST_FITTING');
      const corner = matches[0];
      assignment.push(corner);
      assert.equal(geometry.uvs[vertex * 2], quad.cornerUVs[corner][0], 'F1_EXACT_U');
      assert.equal(geometry.uvs[vertex * 2 + 1], quad.cornerUVs[corner][1], 'F1_EXACT_V');
      for (let channel = 0; channel < 4; channel++) {
        const [numerator, denominator] = quad.lightRGBA[channel];
        assert.equal(geometry.lightColors[vertex * 4 + channel], numerator / denominator, 'F1_EXACT_ACTUAL_VERTEX_CHANNEL');
      }
    }
    assert.equal(new Set(assignment).size, 4, 'F1_FOUR_UNIQUE_CORNERS');
    assert.deepEqual(geometry.indices, [0, 1, 2, 2, 3, 0], 'F1_CONFIRMED_CORE_EXACT_ACTIVE_INDICES');
    const triangles = [geometry.indices.slice(0, 3), geometry.indices.slice(3, 6)].map(indices => {
      assert.equal(indices.length, 3);
      for (const index of indices) assert.ok(Number.isInteger(index) && index >= 0 && index < 4);
      const corners = indices.map(index => assignment[index]);
      assert.equal(new Set(corners).size, 3, 'F1_NONDEGENERATE_TRIANGLE');
      return corners;
    });
    const shared = triangles[0].filter(corner => triangles[1].includes(corner));
    assert.equal(shared.length, 2, 'F1_TWO_TRIANGLES_ONE_DIAGONAL');
    assert.equal(Math.abs(shared[0] - shared[1]), 2, 'F1_DIAGONAL_OPPOSITE_CORNERS');
    assert.equal(new Set(triangles.flat()).size, 4, 'F1_COMPLETE_QUAD_COVERAGE');
  }
  return meshes;
}
function checkFrame(frame, instance, page) {
  const meshes = leaves(instance);
  assert.equal(frame.profile, sdk.TEXTURED_FRAME_PROFILE_2D);
  assert.equal(frame.images.length, 1);
  assert.equal(frame.images[0], page.imageData);
  assert.equal(frame.commands.length, 2, 'F1_BACK_BEFORE_FRONT');
  for (let index = 0; index < 2; index++) {
    const command = frame.commands[index];
    assert.equal(command.kind, 'mesh');
    assert.equal(command.imageIndex, 0);
    assert.equal(frame.geometries[command.geometryIndex], meshes[index].geometry);
    assert.deepEqual(command.sourceRect, { x: 0, y: 0, width: 16, height: 16 });
  }
}

// A callback-window witness records the state at attempted reentry. It does not
// inspect core state or invent Engine.state; genuine group ownership is decisive.
function rejectedReentry(instance, originalLeaves) {
  const elapsed = instance.elapsedSeconds;
  // Container cleanup may already detach children. Retained genuine leaves keep
  // observation possible without requiring a closed tree to remain traversable.
  const before = (originalLeaves ?? retained(instance)).map(item => ({
    mesh: item.mesh, geometry: item.mesh.geometry, values: copyGeometry(item.mesh.geometry),
  }));
  let error;
  try { instance.step(0.25); } catch (caught) { error = caught; }
  return { error, elapsedBefore: elapsed, elapsedAfter: instance.elapsedSeconds,
    before, after: before.map(item => ({ geometry: item.mesh.geometry, values: copyGeometry(item.mesh.geometry) })) };
}
function checkReentry(witness) {
  assert.ok(witness, 'F1_REAL_CLOSE_CALLBACK_REQUIRED');
  assert.ok(witness.error instanceof Error, 'F1_CLOSE_CALLBACK_STEP_REFUSED');
  assert.equal(witness.elapsedAfter, witness.elapsedBefore, 'F1_CLOSE_CALLBACK_NO_STATE_STEP');
  for (let index = 0; index < witness.before.length; index++) {
    assert.equal(witness.after[index].geometry, witness.before[index].geometry, 'F1_CLOSE_CALLBACK_NO_GEOMETRY_COMMIT');
    assert.deepEqual(witness.after[index].values, witness.before[index].values);
  }
  unchanged(witness.before);
}
function includesCause(error, cause) {
  const seen = new Set();
  while (error !== undefined && !seen.has(error)) {
    if (error === cause) return true;
    seen.add(error);
    error = error?.cause;
  }
  return false;
}

test('F1 private manual bridge: real setup, named module RED, then fixed acceptance', { timeout: 15000 }, async t => {
  let admissionPassed = false;
  await t.test('admission: exact authored files and genuine public SDK graph', async () => {
    await checkPin(manifest.sdkGraph.receipt);
    const graph = JSON.parse(await readFile(manifest.sdkGraph.receipt.path, 'utf8'));
    assert.equal(graph.kind, 'CURRENT_CLONE_BUILT_PUBLIC_INPUTS');
    assert.equal(graph.historicalTreeBinding, false);
    for (const row of graph.rows) await checkPin({ ...row, path: resolve(graph.root, row.path) });
    assert.equal(graph.engineURL, pathToFileURL(manifest.sdkGraph.engineEntry).href);
    assert.equal(graph.projectSpineURL, pathToFileURL(manifest.sdkGraph.spinePlanningEntry).href);
    for (const pin of manifest.sdkGraph.files) await checkPin(pin);
    for (const pin of manifest.preservedInputs) {
      assert.equal(typeof pin.logicalIdentity, 'string');
      assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0);
      assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    }
    for (const pin of manifest.authoredFiles) await checkPin(pin, true);
    const bytes = await readFile(file('egret-original-page.rgba'));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const expected = y < 8 ? (x < 8 ? [255, 0, 0, 255] : [0, 0, 255, 255]) : (x < 8 ? [0, 255, 0, 255] : [255, 255, 0, 255]);
      assert.deepEqual([...bytes.subarray(4 * (16 * y + x), 4 * (16 * y + x + 1))], expected);
    }
    sdk = await import(pathToFileURL(manifest.sdkGraph.engineEntry).href);
    helpers = await import(pathToFileURL(manifest.sdkGraph.helperEntry).href);
    const importer = await import(pathToFileURL(manifest.sdkGraph.spinePlanningEntry).href);
    const provenance = { origin: 'Egret independently authored F1 fixture', license: 'Apache-2.0', notice: 'No upstream art or implementation copied' };
    const result = importer.createSpineImportPlan({
      skeleton: { id: 'F1 skeleton', text: await readFile(file('egret-original-slide.spine.json'), 'utf8'), provenance },
      atlas: { id: 'F1 atlas', text: await readFile(file('egret-original-slide.atlas'), 'utf8'), provenance },
      pages: [{ pageName: 'egret-original-page.png', assetId: 'egret-original-page.rgba', provenance }],
    });
    assert.equal(result.ok, true, 'F1_GENUINE_OPTIONAL_PLANNING_SETUP');
    assert.equal(result.value.acceptance.rendering, 'not_run');
    assert.equal(result.value.acceptance.licenseEntitlement, 'unverified');
    admissionPassed = true;
  });
  if (!admissionPassed) return;

  let baselinePassed = false;
  await t.test('admission: actual providers, whole-page lease, Texture and Mesh2D before bridge', async () => {
    await withEngine(async (engine, h) => {
      const p = providers(engine), scope = engine.createScope();
      const headers = engine.createAssetGroup(scope, [p.refs.skeleton, p.refs.atlas], { concurrency: 2 });
      assert.equal((await headers.ready).length, 2);
      const pages = engine.createAssetGroup(scope, [p.refs.page], { concurrency: 1 });
      const [lease] = await pages.ready;
      assert.ok(lease instanceof sdk.AssetLease);
      const geometry = sdk.createTexturedGeometry2D({
        positions: new Float32Array([0, 0, 2, 0, 0, 2]),
        uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
        lightColors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        indices: new Uint16Array([0, 1, 2]),
      });
      // This separate triangle proves SDK setup; it is never Spine candidate data.
      const mesh = scope.use(new sdk.Mesh2D(lease, geometry));
      // Genuine negotiated render admission precedes the bridge import.
      engine.stage.addChild(mesh);
      const rendered = engine.renderTexturedFrame(frameOptions);
      assert.equal(rendered.profile, sdk.TEXTURED_FRAME_PROFILE_2D);
      assert.equal(rendered.commands.length, 1);
      assert.equal(h.frames.length, 1);
      assert.equal(h.frames[0], rendered, 'F1_GENUINE_TEXTURED_RENDER_PORT_BASELINE');
      assert.equal(mesh.geometry, geometry);
      assert.equal(mesh.textureLease, lease);
      assert.equal(lease.value, p.loadedPages[0]);
      assert.deepEqual(lease.value.sourceRect, { x: 0, y: 0, width: 16, height: 16 });
      scope.dispose();
      assert.equal(mesh.isDisposed, true);
      assert.equal(p.disposedText.length, 2);
      assert.equal(p.disposedPages.length, 1);
    });
    baselinePassed = true;
  });
  if (!baselinePassed) return;

  let factory;
  await t.test('assigned first-party module RED: F1_MANUAL_BRIDGE_MODULE_REQUIRED after successful setup', async () => {
    const entry = new URL('out/f1-manual-bridge.js', root);
    // Retain the original module-boundary child contract. This portable run
    // verifies the compiled entry; missing modules remain INCOMPLETE.
    const bridge = await import(entry.href);
    assert.equal(typeof bridge.createF1ManualResources, 'function', 'F1_MANUAL_FACTORY_REQUIRED');
    factory = bridge.createF1ManualResources;
  });
  if (factory === undefined) return;

  let positionTolerance;
  await t.test('separately reviewed numeric admission; literal pixels remain exact', async () => {
    const policy = oracle.numericPolicy.position;
    assert.equal(policy.status, 'ACCEPTED_SEALED_REVIEW_BOUND', 'F1_POSITION_PRECISION_POLICY_PENDING');
    assert.equal(policy.absolute, 2 ** -20);
    assert.ok(policy.reviewReceipt && policy.constantQualification, 'F1_TRIG_CONSTANT_QUALIFICATION_REQUIRED');
    assert.equal(policy.reviewReceipt.logicalIdentity, 'original-f1-fixed-precision-review');
    assert.equal(policy.constantQualification.logicalIdentity, 'historical-f1-canonical-qualification');
    await checkPin(manifest.numericQualification);
    const qualified = JSON.parse(await readFile(manifest.numericQualification.path, 'utf8'));
    assert.equal(qualified.upstreamFilesBeforeAfterUnchanged, true);
    assert.equal(qualified.precision.tolerance, policy.absolute);
    assert.equal(qualified.precision.reviewSHA256, policy.reviewReceipt.sha256);
    // These original constant-level checks are independent of any geometry.
    const theta = 90 * (3.1415927 / 180);
    assert.equal(Math.cos(0), 1); assert.equal(Math.sin(0), 0);
    assert.ok(Math.abs(Math.cos(theta)) <= 2.4e-8, 'F1_HOST_QUARTER_COS_PREMISE');
    assert.ok(Math.abs(Math.sin(theta) - 1) <= 2 ** -48, 'F1_HOST_QUARTER_SIN_PREMISE');
    assert.equal(oracle.nativeSuccessor.channelTolerance, 0);
    positionTolerance = policy.absolute;
  });
  if (positionTolerance === undefined) return;

  await t.test('fixed poses, invalid/zero/manual time, independent instances and old immutable geometry', async () => {
    await withEngine(async (engine, h) => {
      const p = providers(engine), scope = engine.createScope();
      const resources = await factory(engine, scope, p.refs);
      const scopeA = engine.createScope(), scopeB = engine.createScope();
      const A = resources.createInstance(scopeA), B = resources.createInstance(scopeB);
      const page = p.loadedPages[0], clock = clockSnapshot(engine);
      engine.stage.addChild(A.display);
      checkInstance(A, 0, page, positionTolerance); checkInstance(B, 0, page, positionTolerance);
      const old = retained(A);
      A.step(0);
      checkFrame(engine.captureTexturedFrame(frameOptions), A, page);
      checkFrame(engine.renderTexturedFrame(frameOptions), A, page);
      sameSlots(old); assert.equal(A.elapsedSeconds, 0);
      for (const delta of [-1, NaN, Infinity, -Infinity, 0.25000000000000006]) {
        const before = retained(A);
        assert.throws(() => A.step(delta), Error, 'F1_INVALID_DELTA_REFUSED');
        assert.equal(A.elapsedSeconds, 0); sameSlots(before);
      }
      A.step(0.25); A.step(0.25);
      checkInstance(A, 0.5, page, positionTolerance); checkInstance(B, 0, page, positionTolerance);
      assert.notEqual(leaves(A)[0].geometry, old[0].geometry, 'F1_CHANGED_POSE_NEW_GEOMETRY');
      unchanged(old);
      checkFrame(engine.renderTexturedFrame(frameOptions), A, page);
      A.step(0.25); A.step(0.25);
      checkInstance(A, 1, page, positionTolerance); checkInstance(B, 0, page, positionTolerance);
      unchanged(old); unchangedClock(engine, clock);
      assert.equal(h.frames.length, 2, 'F1_REAL_CPU_PORT_NOT_GPU_ACCEPTANCE');
      A.dispose(); A.dispose();
      assert.equal(A.display.isDisposed, true);
      assert.throws(() => A.step(0.25));
      assert.equal(p.disposedPages.length, 0, 'F1_INSTANCE_DOES_NOT_OWN_SHARED_PAGE');
      B.step(0.25); B.step(0.25);
      checkInstance(B, 0.5, page, positionTolerance);
      unchangedClock(engine, clock);
      scope.dispose(); scope.dispose(); resources.dispose();
      assert.equal(B.display.isDisposed, true);
      assert.throws(() => B.step(0.25));
      assert.throws(() => resources.createInstance(engine.createScope()));
      assert.equal(p.loadedPages.length, 1);
      assert.equal(p.disposedPages.length, 1);
      assert.equal(p.disposedText.length, 2);
    });
  });

  await t.test('genuine foreign Scope refuses without retiring valid resources', async () => {
    await withEngine(async engine => {
      await withEngine(async foreign => {
        const p = providers(engine), scope = engine.createScope();
        const resources = await factory(engine, scope, p.refs);
        assert.throws(() => resources.createInstance(foreign.createScope()), error =>
          error instanceof sdk.EgretError && error.code === 'ENGINE_MISMATCH');
        assert.equal(p.disposedPages.length, 0);
        const own = resources.createInstance(engine.createScope());
        own.step(0.25); own.step(0.25);
        checkInstance(own, 0.5, p.loadedPages[0], positionTolerance);
        scope.dispose();
        assert.equal(own.display.isDisposed, true);
        assert.equal(p.disposedPages.length, 1);
      });
    });
  });

  await t.test('instance Scope abort refuses before its reverse cleanup', async () => {
    await withEngine(async engine => {
      const p = providers(engine), resourceScope = engine.createScope(), instanceScope = engine.createScope();
      const resources = await factory(engine, resourceScope, p.refs);
      const A = resources.createInstance(instanceScope);
      A.step(0.25); assert.equal(A.elapsedSeconds, 0.25);
      const originalLeaves = retained(A);
      let witness, scopeState;
      instanceScope.signal.addEventListener('abort', () => {
        scopeState = instanceScope.state;
        witness = rejectedReentry(A, originalLeaves);
      }, { once: true });
      instanceScope.dispose();
      assert.equal(scopeState, 'closing'); checkReentry(witness);
      assert.equal(A.display.isDisposed, true);
      assert.equal(p.disposedPages.length, 0);
      resourceScope.dispose();
      assert.equal(p.disposedPages.length, 1);
    });
  });

  for (const closing of ['resource Scope', 'Engine']) await t.test(`${closing} page-disposer reentry refuses at real close boundary`, async () => {
    await withEngine(async engine => {
      let B, witness, originalLeaves;
      const p = providers(engine, { onPageDispose() { witness = rejectedReentry(B, originalLeaves); } });
      const resourceScope = engine.createScope();
      const resources = await factory(engine, resourceScope, p.refs);
      B = resources.createInstance(engine.createScope());
      B.step(0.25); assert.equal(B.elapsedSeconds, 0.25);
      const saved = retained(B);
      originalLeaves = saved;
      if (closing === 'Engine') await engine.dispose(); else resourceScope.dispose();
      checkReentry(witness); unchanged(saved);
      assert.equal(B.display.isDisposed, true);
      assert.equal(p.disposedPages.length, 1);
      assert.throws(() => B.step(0.25));
    });
  });

  await t.test('page failure retains original cause and closes acquired real headers', async () => {
    await withEngine(async engine => {
      const original = new Error('F1 original provider failure');
      const p = providers(engine, { pageError: original });
      const resourceScope = engine.createScope();
      await assert.rejects(factory(engine, resourceScope, p.refs), error => includesCause(error, original));
      resourceScope.dispose();
      assert.equal(p.loadedText.length, 2);
      assert.equal(p.disposedText.length, 2);
      assert.equal(p.loadedPages.length, 0);
      assert.equal(p.disposedPages.length, 0);
    });
  });

  await t.test('resource cancellation retires a genuine late page once and publishes no facade', async () => {
    await withEngine(async engine => {
      const pageGate = helpers.deferred(), p = providers(engine, { pageGate });
      const resourceScope = engine.createScope();
      const observed = factory(engine, resourceScope, p.refs).then(value => ({ value }), error => ({ error }));
      const started = await p.pageStarted.promise;
      resourceScope.dispose();
      assert.equal(started.signal.aborted, true);
      const outcome = await observed;
      assert.ok(outcome.error instanceof Error, 'F1_CANCELLED_NO_PUBLICATION');
      assert.equal(outcome.value, undefined);
      pageGate.resolve();
      assert.equal(await p.pageDisposed.promise, started.texture);
      assert.equal(p.disposedPages.length, 1);
      assert.equal(p.disposedText.length, 2);
      assert.equal(started.texture.isDisposed, true);
    });
  });
});
