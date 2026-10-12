// SPDX-License-Identifier: Apache-2.0
// Independently authored portable F1-CLOCK admission successor; replay is opt-in.
// Only admission metadata adapts the sealed private test; literal behavior is unchanged.
// No product/upstream algorithm supplies expected geometry, time or cleanup order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const options = Object.freeze({ width: 64, height: 48, clearColor: 0, clearAlpha: 0 });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let admitted;

async function pin(row, relative = false) {
  const bytes = await readFile(relative ? new URL(row.path, root) : row.path);
  assert.equal(bytes.length, row.bytes, `F1C_INPUT_BYTES_CHANGED: ${row.path}`);
  assert.equal(sha256(bytes), row.sha256, `F1C_INPUT_SHA_CHANGED: ${row.path}`);
  return bytes;
}
async function inputs() {
  if (admitted === undefined) admitted = (async () => {
    const graph = JSON.parse((await pin(manifest.sdkGraph.receipt)).toString('utf8'));
    assert.equal(graph.kind, 'CURRENT_CLONE_BUILT_PUBLIC_INPUTS');
    assert.equal(graph.historicalTreeBinding, false);
    for (const row of graph.rows) await pin({ ...row, path: resolve(graph.root, row.path) });
    for (const row of manifest.sdkGraph.files) await pin(row);
    for (const row of manifest.preservedInputs) {
      assert.equal(typeof row.logicalIdentity, 'string');
      assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0);
      assert.match(row.sha256, /^[a-f0-9]{64}$/);
    }
    for (const row of manifest.authoredFiles) await pin(row, true);
    for (const row of manifest.clock.inputPins) await pin(row);
    assert.equal(graph.engineURL, pathToFileURL(manifest.sdkGraph.engineEntry).href);
    const contract = JSON.parse((await pin(manifest.clock.acceptanceContract)).toString('utf8'));
    assert.equal(contract.schemaVersion, 1);
    assert.equal(contract.kind, 'FIRST_PARTY_FIXED_CLOCK_ACCEPTANCE_CONTRACT');
    await pin(manifest.clock.source);
    assert.equal(manifest.clock.source.bytes, contract.source.bytes);
    assert.equal(manifest.clock.source.sha256, contract.source.sha256);
    const coreReceipt = JSON.parse((await pin(manifest.clock.externalCore.receipt)).toString('utf8'));
    assert.equal(coreReceipt.kind, 'CURRENT_SUPPLIED_OFFICIAL_CORE_INPUTS');
    assert.equal(coreReceipt.root, manifest.clock.externalCore.root);
    assert.equal(coreReceipt.regularFileCount, 137);
    assert.equal(coreReceipt.rows.length, 137);
    const tuples = coreReceipt.rows.map(row => [row.relative, row.bytes, row.sha256])
      .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    assert.equal(sha256(Buffer.from(JSON.stringify(tuples))), manifest.core.contentDigestSHA256);
    assert.equal(coreReceipt.contentDigestSHA256, manifest.core.contentDigestSHA256);
    for (const row of coreReceipt.rows) await pin({ ...row, path: resolve(coreReceipt.root, row.relative) });
    const corePackage = JSON.parse(await readFile(resolve(coreReceipt.root, 'package.json'), 'utf8'));
    assert.equal(corePackage.name, '@esotericsoftware/spine-core');
    assert.equal(corePackage.version, '4.3.13');
    assert.equal(await realpath(new URL('node_modules/@egret/engine',root)),await realpath(resolve(dirname(manifest.sdkGraph.engineEntry),'..')),'F1C_GENUINE_SDK_LINK_REQUIRED');
    assert.equal(await realpath(new URL('node_modules/@esotericsoftware/spine-core',root)),await realpath(coreReceipt.root),'F1C_PINNED_CORE_LINK_REQUIRED');
    const sdk = await import(pathToFileURL(manifest.sdkGraph.engineEntry).href);
    const helpers = await import(pathToFileURL(manifest.sdkGraph.helperEntry).href);
    const core = await import(pathToFileURL(manifest.clock.externalCore.entry).href);
    assert.equal(typeof core.Skeleton, 'function');
    assert.equal(typeof core.AnimationState, 'function');
    assert.equal(core.Skeleton.yDown, false);
    const oracle = JSON.parse(await readFile(new URL('fixtures/f1-oracle.json', root), 'utf8'));
    assert.equal(oracle.numericPolicy.position.absolute, 2 ** -20);
    assert.equal(oracle.numericPolicy.position.reviewReceipt.logicalIdentity, 'original-f1-fixed-precision-review');
    assert.equal(oracle.numericPolicy.position.constantQualification.logicalIdentity, 'historical-f1-canonical-qualification');
    const qualified = JSON.parse((await pin(manifest.numericQualification)).toString('utf8'));
    assert.equal(qualified.upstreamFilesBeforeAfterUnchanged, true);
    assert.equal(qualified.precision.tolerance, oracle.numericPolicy.position.absolute);
    assert.equal(qualified.precision.reviewSHA256, oracle.numericPolicy.position.reviewReceipt.sha256);
    const theta = 90 * (3.1415927 / 180);
    assert.equal(Math.cos(0), 1); assert.equal(Math.sin(0), 0);
    assert.ok(Math.abs(Math.cos(theta)) <= 2.4e-8);
    assert.ok(Math.abs(Math.sin(theta) - 1) <= 2 ** -48);
    assert.equal(oracle.nativeSuccessor.channelTolerance, 0);
    return { sdk, helpers, core, oracle };
  })();
  return admitted;
}
async function bridge() {
  // Import namespace after admitted setup; never statically import a missing name.
  return import(new URL('out/f1-manual-bridge.js', root).href);
}
async function sessionFactory() {
  await inputs();
  const module = await bridge();
  assert.equal(typeof module.createF1ClockSession, 'function', 'F1_CLOCK_SESSION_REQUIRED');
  return module.createF1ClockSession;
}
function errorCode(sdk, action, code) {
  let caught;
  assert.throws(action, error => {
    caught = error; assert.ok(error instanceof sdk.EgretError);
    assert.equal(error.code, code); return true;
  });
  return caught;
}
function causeContains(error, target) {
  const seen = new Set(), pending = [error];
  while (pending.length !== 0) {
    const current = pending.pop();
    if (current === target) return true;
    if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current); pending.push(current.cause, ...(current.cleanupErrors ?? []));
  }
  return false;
}
function profileHost(sdk, helpers, overrides = {}) {
  const frames = [];
  const host = helpers.host({ texturedFrameProfile: sdk.TEXTURED_FRAME_PROFILE_2D,
    renderTexturedFrame(frame) { frames.push(frame); return undefined; }, ...overrides });
  return { ...host, frames };
}
function providers(sdk, engine, controls = {}) {
  const text = sdk.createAssetType('F1C original text', value => typeof value === 'string');
  const page = sdk.createAssetType('F1C original page', sdk.isTexture);
  const refs = Object.freeze({
    skeleton: sdk.createAssetRef(text, 'egret-original-slide.spine.json'),
    atlas: sdk.createAssetRef(text, 'egret-original-slide.atlas'),
    page: sdk.createAssetRef(page, 'egret-original-page.rgba'),
  });
  const loadedText = [], disposedText = [], loadedPages = [], disposedPages = [];
  engine.assets.register(text, {
    async load(ref, context) {
      assert.ok(ref.id === refs.skeleton.id || ref.id === refs.atlas.id);
      const bytes = await readFile(new URL(`fixtures/${ref.id}`, root));
      assert.ok(bytes.length <= 65536);
      if (context.signal.aborted) throw context.signal.reason;
      const value = bytes.toString('utf8'); loadedText.push(value); return value;
    },
    dispose(value) { disposedText.push(value); },
  });
  engine.assets.register(page, {
    async load(ref, context) {
      assert.equal(ref.id, refs.page.id);
      const bytes = await readFile(new URL(`fixtures/${ref.id}`, root));
      assert.equal(bytes.length, 1024);
      if (context.signal.aborted) throw context.signal.reason;
      const pixels = new Uint8Array(bytes);
      // Independent original quadrant literals, not candidate-generated pixels.
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const rgba = y < 8 ? (x < 8 ? [255,0,0,255] : [0,0,255,255]) : (x < 8 ? [0,255,0,255] : [255,255,0,255]);
        assert.deepEqual([...pixels.subarray((y * 16 + x) * 4, (y * 16 + x + 1) * 4)], rgba);
      }
      const texture = sdk.createTexture(sdk.createImageData2D({ width:16, height:16, pixels,
        format:'rgba8unorm', colorSpace:'srgb', alphaMode:'straight', origin:'top-left' }));
      loadedPages.push(texture); return texture;
    },
    dispose(texture) { disposedPages.push(texture); controls.onPageDispose?.(texture); texture.dispose(); },
  });
  return { refs, loadedText, disposedText, loadedPages, disposedPages };
}
function leaves(sdk, instance) {
  assert.ok(instance.display instanceof sdk.DisplayObjectContainer);
  assert.equal(instance.display.numChildren, 2, 'F1C_TWO_ORIGINAL_QUADS');
  return [0,1].map(index => {
    const mesh = instance.display.getChildAt(index);
    assert.ok(mesh instanceof sdk.Mesh2D); return mesh;
  });
}
function geometryValues(geometry) {
  return geometry === undefined ? undefined : { positions:[...geometry.positions], uvs:[...geometry.uvs],
    lightColors:[...geometry.lightColors], indices:[...geometry.indices] };
}
function retained(sdk, instance) {
  return leaves(sdk, instance).map(mesh => ({ mesh, geometry:mesh.geometry, values:geometryValues(mesh.geometry) }));
}
function sameGeometry(saved) {
  for (const row of saved) {
    assert.equal(row.mesh.geometry, row.geometry, 'F1C_NO_GEOMETRY_COMMIT');
    assert.deepEqual(geometryValues(row.mesh.geometry), row.values);
    assert.deepEqual(geometryValues(row.geometry), row.values, 'F1C_RETAINED_OWNED_COPY');
  }
}
function reentry(instance, saved) {
  // Disposed Mesh slots may already be empty. Compare the actual callback window,
  // while separately preserving earlier immutable geometry values after cleanup.
  const before = saved.map(row => ({ mesh:row.mesh, geometry:row.mesh.geometry, values:geometryValues(row.mesh.geometry) }));
  const witness = { elapsedBefore:instance.elapsedSeconds, before, failures:[] };
  for (const action of [()=>instance.step(NaN),()=>instance.bindClock({})]) {
    try { action(); } catch (error) { witness.failures.push(error); }
  }
  witness.elapsedAfter=instance.elapsedSeconds;
  witness.after=before.map(row=>({geometry:row.mesh.geometry,values:geometryValues(row.mesh.geometry)}));
  return witness;
}
function reentryUnchanged(witness, code) {
  assert.ok(witness);assert.equal(witness.elapsedAfter,witness.elapsedBefore);assert.equal(witness.failures.length,2);
  for(const error of witness.failures)assert.equal(error.code,code);
  for(let index=0;index<witness.before.length;index++){
    assert.equal(witness.after[index].geometry,witness.before[index].geometry,'F1C_CLOSE_WINDOW_NO_GEOMETRY_COMMIT');
    assert.deepEqual(witness.after[index].values,witness.before[index].values);
  }
}
function pose(sdk, oracle, instance, time, page) {
  assert.equal(instance.elapsedSeconds, time, 'F1C_EXACT_LOCAL_TIME');
  const literal = oracle.frames.find(frame => frame.t === time);
  assert.ok(literal, 'F1C_ORIGINAL_LITERAL_FRAME_REQUIRED');
  assert.deepEqual([instance.display.x,instance.display.y], [24,24]);
  const meshes = leaves(sdk, instance);
  for (let command = 0; command < 2; command++) {
    const mesh = meshes[command], geometry = mesh.geometry, quad = literal.quads[command];
    assert.ok(sdk.isTexturedGeometry2D(geometry)); assert.ok(Object.isFrozen(geometry));
    assert.deepEqual([geometry.vertexCount,geometry.indexCount], [4,6]);
    assert.equal(mesh.textureLease.value, page);
    const assignment = [];
    for (let vertex = 0; vertex < 4; vertex++) {
      const point = mesh.localToGlobal(geometry.positions[vertex * 2], geometry.positions[vertex * 2 + 1]);
      const matches = quad.corners.map(([x,y], corner) => Math.abs(point.x-x) <= 2**-20 && Math.abs(point.y-y) <= 2**-20 ? corner : -1).filter(corner => corner >= 0);
      assert.equal(matches.length, 1, 'F1C_FIXED_CORNER_BIJECTION');
      const corner = matches[0]; assignment.push(corner);
      assert.equal(geometry.uvs[vertex*2], quad.cornerUVs[corner][0]);
      assert.equal(geometry.uvs[vertex*2+1], quad.cornerUVs[corner][1]);
      for (let channel = 0; channel < 4; channel++) assert.equal(geometry.lightColors[vertex*4+channel], quad.lightRGBA[channel][0]/quad.lightRGBA[channel][1]);
    }
    assert.equal(new Set(assignment).size, 4);
    assert.deepEqual(geometry.indices, [0,1,2,2,3,0]);
    const triangles = [geometry.indices.slice(0,3), geometry.indices.slice(3,6)].map(indices => indices.map(index => assignment[index]));
    assert.ok(triangles.every(corners => new Set(corners).size === 3));
    const shared = triangles[0].filter(corner => triangles[1].includes(corner));
    assert.equal(shared.length, 2); assert.equal(Math.abs(shared[0]-shared[1]), 2);
    assert.equal(new Set(triangles.flat()).size, 4);
  }
  return meshes;
}
function clockView(clock) { return { state:clock.state, elapsed:clock.elapsedSeconds, tick:clock.tickId }; }
function sample(sdk, engine, source) { return Reflect.apply(sdk.Engine.prototype.advanceTime, engine, [source]); }
async function ownedSession(action, clock, factoryOverride) {
  const input = await inputs(), factory = factoryOverride ?? await sessionFactory();
  const h = profileHost(input.sdk, input.helpers);
  const session = await factory({ host:h.adapter, ...(clock === undefined ? {} : { clock }) });
  const engine = session.engine;
  assert.ok(engine instanceof input.sdk.Engine);
  const authenticClock = engine.clock;
  const context = { ...input, h, session, engine, clock:authenticClock, createdProviders:[] };
  try { await action(context); }
  finally { await engine.dispose(); }
  assert.deepEqual(h.trace, ['start','stop','close']); assert.equal(h.timers.size, 0);
  for(const provider of context.createdProviders)counts(provider);
}
async function originalInstances(context, controls = {}) {
  const { sdk, engine, session } = context, p = providers(sdk, engine, controls);
  context.createdProviders.push(p);
  const resourceScope = engine.createScope(), scopeA = engine.createScope(), scopeB = engine.createScope();
  const resources = await session.createResources(resourceScope, p.refs);
  const A = resources.createInstance(scopeA), B = resources.createInstance(scopeB);
  return { p, resourceScope, scopeA, scopeB, resources, A, B, page:p.loadedPages[0] };
}
function bind(instance, scope) {
  assert.equal(typeof instance.bindClock, 'function', 'F1_CLOCK_BIND_REQUIRED');
  const handle = instance.bindClock(scope);
  assert.ok(Object.isFrozen(handle)); assert.equal(handle.isDisposed, false); return handle;
}
function counts(p) { assert.deepEqual([p.loadedText.length,p.disposedText.length,p.loadedPages.length,p.disposedPages.length], [2,2,1,1]); }
async function completedBaseline(baseline, expectedPass, expectedSkip, mutationStartedAtUTC) {
  const receipt=JSON.parse((await pin(baseline.receipt)).toString('utf8'));
  assert.ok(Array.isArray(receipt));
  const matching=receipt.filter(row=>row.name===baseline.command);
  assert.equal(matching.length,1);const command=matching[0];
  assert.equal(command.exitCode,0);assert.equal(command.timeout,false);assert.equal(command.signal,null);
  assert.equal(command.launchError,undefined);
  const stdout=await pin(command.stdout),stderr=await pin(command.stderr);
  assert.equal(stderr.length,0);
  const tap=stdout.toString('utf8');
  assert.match(tap,new RegExp('^# pass '+expectedPass+'\\r?$','m'));assert.match(tap,/^# fail 0\r?$/m);
  assert.match(tap,new RegExp('^# skipped '+expectedSkip+'\\r?$','m'));
  assert.ok(Number.isFinite(Date.parse(command.finishedAtUTC)));assert.ok(Number.isFinite(Date.parse(mutationStartedAtUTC)));
  assert.ok(Date.parse(command.finishedAtUTC)<=Date.parse(mutationStartedAtUTC),'F1C_ACTUAL_BASELINE_MUST_PRECEDE_ACTOR');
}

test('F1C00 actual public setup precedes F1_CLOCK_SESSION_REQUIRED', { timeout:15000 }, async t => {
  const { sdk, helpers, oracle } = await inputs(), h = profileHost(sdk, helpers);
  const engine = await sdk.createEngineForProfile({ host:h.adapter }, sdk.TEXTURED_FRAME_PROFILE_2D);
  let imported, p;
  try {
    p = providers(sdk, engine); const scope = engine.createScope();
    const headers = engine.createAssetGroup(scope, [p.refs.skeleton,p.refs.atlas], { concurrency:2 });
    assert.equal((await headers.ready).length, 2);
    const pages = engine.createAssetGroup(scope, [p.refs.page], { concurrency:1 });
    const [lease] = await pages.ready; assert.ok(lease instanceof sdk.AssetLease);
    const geometry = sdk.createTexturedGeometry2D({ positions:new Float32Array([0,0,2,0,0,2]),
      uvs:new Float32Array([0,0,1,0,0,1]), lightColors:new Float32Array(12).fill(1), indices:new Uint16Array([0,1,2]) });
    const mesh = scope.use(new sdk.Mesh2D(lease, geometry)); engine.stage.addChild(mesh);
    const frame = engine.renderTexturedFrame(options);
    assert.equal(frame.profile, sdk.TEXTURED_FRAME_PROFILE_2D); assert.equal(frame.commands.length, 1);
    assert.equal(h.frames[0], frame); assert.equal(mesh.textureLease.value, p.loadedPages[0]);
    const ticks = [], observer = engine.createScope();
    const subscription = engine.clock.onTick(observer, tick => { ticks.push(tick); return undefined; });
    assert.equal(sample(sdk, engine, 2), undefined);
    assert.deepEqual(sample(sdk, engine, 2.125), { tickId:1, elapsedSeconds:.125, deltaSeconds:.125 });
    assert.equal(ticks.length, 1); subscription.dispose();
    imported = await bridge();
    assert.equal(typeof imported.createF1ManualResources, 'function', 'F1C_ORIGINAL_MANUAL_FACTORY_BASELINE');
    const resources = await imported.createF1ManualResources(engine, engine.createScope(), p.refs);
    const A = resources.createInstance(engine.createScope()); pose(sdk, oracle, A, 0, p.loadedPages[0]);
    A.step(0); assert.equal(A.elapsedSeconds, 0);
    assert.deepEqual(clockView(engine.clock), { state:'running', elapsed:.125, tick:1 });
    t.diagnostic('F1C_ACTUAL_SETUP_COMPLETE: public SDK/core/providers/groups/Mesh/render/Clock/original manual factory');
  } finally { await engine.dispose(); }
  assert.deepEqual(h.trace, ['start','stop','close']); assert.equal(h.timers.size, 0);
  counts(p);
  // This exact assertion is the only assigned RED, after cleanup and genuine setup.
  assert.equal(typeof imported.createF1ClockSession, 'function', 'F1_CLOCK_SESSION_REQUIRED');
});

test('F1C01 two bound instances advance once; render/capture/baseline stay inert', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,oracle,engine,clock,h } = context, { A,B,page } = await originalInstances(context);
  engine.stage.addChild(A.display);
  const before = retained(sdk,A), beforeB = retained(sdk,B), handles = [bind(A,engine.createScope()),bind(B,engine.createScope())];
  assert.notEqual(handles[0],handles[1]); pose(sdk,oracle,A,0,page); pose(sdk,oracle,B,0,page);
  assert.equal(sample(sdk,engine,10),undefined); assert.equal(sample(sdk,engine,10),undefined);
  const savedClock = clockView(clock);
  for (let repeat = 0; repeat < 2; repeat++) {
    const frame = engine.renderTexturedFrame(options); engine.captureTexturedFrame(options);
    assert.equal(frame.commands.length,2); assert.equal(frame.geometries[frame.commands[0].geometryIndex], leaves(sdk,A)[0].geometry);
    assert.equal(frame.geometries[frame.commands[1].geometryIndex], leaves(sdk,A)[1].geometry);
  }
  assert.equal(h.frames.length,2); sameGeometry(before); sameGeometry(beforeB); assert.deepEqual(clockView(clock),savedClock);
  for (const source of [10.25,10.5]) sample(sdk,engine,source);
  pose(sdk,oracle,A,.5,page); pose(sdk,oracle,B,.5,page);
  const middle = retained(sdk,A); engine.renderTexturedFrame(options); engine.captureTexturedFrame(options); sameGeometry(middle);
  for (const source of [10.75,11]) sample(sdk,engine,source);
  pose(sdk,oracle,A,1,page); pose(sdk,oracle,B,1,page); assert.deepEqual(clockView(clock),{state:'running',elapsed:1,tick:4});
  for (const row of before) assert.deepEqual(geometryValues(row.geometry),row.values);
}));

test('F1C02 active binding excludes manual step; detach/rebind keeps independent local time', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,oracle,engine } = context, { A,B,page,p } = await originalInstances(context);
  A.step(.25); const bindingScope = engine.createScope(), handle = bind(A,bindingScope); bind(B,engine.createScope());
  const old = retained(sdk,A);
  for (const delta of [0,NaN,.25]) errorCode(sdk,()=>A.step(delta),'F1_CLOCK_BOUND');
  errorCode(sdk,()=>A.bindClock({}),'F1_CLOCK_BOUND'); sameGeometry(old); assert.equal(A.elapsedSeconds,.25);
  const disposedGetter = Object.getOwnPropertyDescriptor(handle,'isDisposed').get;
  errorCode(sdk,()=>Reflect.apply(disposedGetter,{},[]),'CLOCK_SUBSCRIPTION_INVALID');
  errorCode(sdk,()=>Reflect.apply(handle.dispose,{},[]),'CLOCK_SUBSCRIPTION_INVALID');
  errorCode(sdk,()=>engine.createScope().use(handle),'OWNERSHIP_CONFLICT');
  sample(sdk,engine,0); sample(sdk,engine,.25); pose(sdk,oracle,A,.5,page); assert.equal(B.elapsedSeconds,.25);
  handle.dispose(); handle.dispose(); assert.equal(handle.isDisposed,true);
  A.step(.25); assert.equal(A.elapsedSeconds,.75); sample(sdk,engine,.5); pose(sdk,oracle,B,.5,page); assert.equal(A.elapsedSeconds,.75);
  const rebind = bind(A,engine.createScope()), saved = retained(sdk,A); assert.notEqual(rebind,handle);
  sameGeometry(saved); assert.equal(A.elapsedSeconds,.75);
  sample(sdk,engine,.75); pose(sdk,oracle,A,1,page); assert.equal(B.elapsedSeconds,.75);
  A.dispose(); assert.equal(rebind.isDisposed,true); assert.equal(p.disposedPages.length,0);
}));

test('F1C03 pause and refused hitches preserve time until explicit resumed baseline', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,engine,clock } = context, { A } = await originalInstances(context); bind(A,engine.createScope());
  sample(sdk,engine,0); sample(sdk,engine,.125); assert.equal(A.elapsedSeconds,.125);
  const saved = retained(sdk,A); clock.pause(); assert.equal(sample(sdk,engine,100),undefined); sameGeometry(saved);
  clock.resume(); assert.equal(sample(sdk,engine,200),undefined); sameGeometry(saved); assert.equal(A.elapsedSeconds,.125);
  sample(sdk,engine,200.125); assert.equal(A.elapsedSeconds,.25);
  const hitch = retained(sdk,A), committed = clockView(clock);
  errorCode(sdk,()=>sample(sdk,engine,201),'CLOCK_DELTA_LIMIT'); sameGeometry(hitch); assert.deepEqual(clockView(clock),committed);
  clock.resume(); errorCode(sdk,()=>sample(sdk,engine,201),'CLOCK_DELTA_LIMIT'); sameGeometry(hitch);
  clock.pause(); clock.resume(); assert.equal(sample(sdk,engine,201),undefined); sameGeometry(hitch);
  sample(sdk,engine,201.125); assert.equal(A.elapsedSeconds,.375); assert.deepEqual(clockView(clock),{state:'running',elapsed:.375,tick:3});
}));

test('F1C04 captured maximum profile rejects after startup and preserves unsafe cleanup cause', { timeout:15000 }, async () => {
  const { sdk,helpers } = await inputs(), factory = await sessionFactory();
  const ordinaryHost = profileHost(sdk,helpers), ordinary = await sdk.createEngineForProfile({host:ordinaryHost.adapter,clock:{maxDeltaSeconds:1}},sdk.TEXTURED_FRAME_PROFILE_2D);
  try { assert.equal(ordinary.clock.maxDeltaSeconds,1); sample(sdk,ordinary,0); assert.equal(sample(sdk,ordinary,.5).deltaSeconds,.5); }
  finally { await ordinary.dispose(); }
  for (const maximum of [.5,1]) {
    const h = profileHost(sdk,helpers); let returned, refusal;
    try { returned = await factory({host:h.adapter,clock:{maxDeltaSeconds:maximum}}); }
    catch (error) { refusal = error; }
    finally { if (returned !== undefined) await returned.engine.dispose(); }
    assert.ok(refusal instanceof sdk.EgretError,'F1C_PROFILE_REFUSAL_REQUIRED'); assert.equal(refusal.code,'F1_CLOCK_PROFILE_UNSUPPORTED');
    assert.deepEqual(h.trace,['start','stop','close']); assert.equal(h.timers.size,0);
  }
  const primary = new Error('F1C real host close rejection'), unsafe = profileHost(sdk,helpers);
  unsafe.adapter.close = async () => { unsafe.trace.push('close'); throw primary; };
  await assert.rejects(factory({host:unsafe.adapter,clock:{maxDeltaSeconds:1}}), error => {
    assert.ok(error instanceof sdk.EgretError); assert.equal(error.code,'F1_CLOCK_SESSION_CLEANUP_FAILED');
    assert.equal(error.cause.code,'F1_CLOCK_PROFILE_UNSUPPORTED'); assert.equal(error.cleanupErrors.length,1);
    assert.equal(error.cleanupErrors[0].code,'ENGINE_CLOSE_FAILED'); assert.ok(causeContains(error.cleanupErrors[0],primary)); return true;
  });
  assert.deepEqual(unsafe.trace,['start','stop','close']); assert.equal(unsafe.timers.size,0);
  // Actual failed host close quarantines its borrowed surface; do not fake safe reuse.
  await assert.rejects(sdk.createEngineForProfile({host:unsafe.adapter},sdk.TEXTURED_FRAME_PROFILE_2D),error=>error.code==='SURFACE_IN_USE');
  assert.deepEqual(unsafe.trace,['start','stop','close']);
  await ownedSession(async context => {
    const { sdk,engine,clock } = context, { A } = await originalInstances(context); bind(A,engine.createScope());
    sample(sdk,engine,0); sample(sdk,engine,.125); const saved = retained(sdk,A);
    errorCode(sdk,()=>sample(sdk,engine,.375),'CLOCK_DELTA_LIMIT'); sameGeometry(saved);
    sample(sdk,engine,.25); assert.equal(A.elapsedSeconds,.25); assert.deepEqual(clockView(clock),{state:'running',elapsed:.25,tick:2});
  },{maxDeltaSeconds:.125});
});

test('F1C05 trusted construction ignores replaced clock and admits only genuine same-Engine Scope', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,helpers,engine,clock,oracle } = context;
  let fakeReads = 0;
  Object.defineProperty(engine,'clock',{value:{get onTick(){fakeReads++;throw new Error('fake clock');},get maxDeltaSeconds(){fakeReads++;throw new Error('fake maximum');}}});
  // Replace the own field before providers/resources, not merely after binding.
  const { A,B,page,p } = await originalInstances(context);
  const foreignHost = profileHost(sdk,helpers), foreign = await sdk.createEngineForProfile({host:foreignHost.adapter},sdk.TEXTURED_FRAME_PROFILE_2D);
  try {
    const closed = engine.createScope(); closed.dispose();
    for (const bad of [{},new Proxy(engine.createScope(),{}),foreign.createScope()]) errorCode(sdk,()=>A.bindClock(bad),'CLOCK_SCOPE_INVALID');
    errorCode(sdk,()=>A.bindClock(closed),'SCOPE_CLOSED');
    A.step(.25); assert.equal(A.elapsedSeconds,.25);
    const scope = engine.createScope(), realSignal = scope.signal, realState = Object.getOwnPropertyDescriptor(sdk.Scope.prototype,'state').get;
    let shadowReads = 0;
    for (const name of ['state','use','signal']) Object.defineProperty(scope,name,{get(){shadowReads++;throw new Error(`replaced ${name}`);}});
    const handle = bind(A,scope); bind(B,engine.createScope()); sample(sdk,engine,0); sample(sdk,engine,.25);
    pose(sdk,oracle,A,.5,page); assert.equal(B.elapsedSeconds,.25); assert.equal(fakeReads,0); assert.equal(shadowReads,0); assert.equal(clock.elapsedSeconds,.25);
    let closingState; realSignal.addEventListener('abort',()=>{closingState=Reflect.apply(realState,scope,[]);},{once:true});
    scope.dispose(); assert.equal(closingState,'closing'); assert.equal(handle.isDisposed,true); assert.equal(shadowReads,0);
    const original = await bridge(), legacy = await original.createF1ManualResources(engine,engine.createScope(),p.refs);
    const manual = legacy.createInstance(engine.createScope()); errorCode(sdk,()=>manual.bindClock({}),'F1_CLOCK_CONTEXT_REQUIRED');
    manual.step(.25); assert.equal(manual.elapsedSeconds,.25);
  } finally { await foreign.dispose(); }
}));

test('F1C06 genuine subscription Scope closing gates abort-before-cleanup reentry', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,oracle,engine,clock } = context, { A,B,page } = await originalInstances(context);
  const scope = engine.createScope(), handle = bind(A,scope); bind(B,engine.createScope());
  sample(sdk,engine,0); sample(sdk,engine,.25); const saved = retained(sdk,A); let witness;
  scope.signal.addEventListener('abort',()=>{
    witness = { state:scope.state, beforeDisposed:handle.isDisposed, beforeElapsed:A.elapsedSeconds, failures:[] };
    for (const action of [()=>A.step(0),()=>A.step(NaN),()=>A.bindClock({})]) { try { action(); } catch (error) { witness.failures.push(error); } }
    try { witness.tick = sample(sdk,engine,.375); } catch (error) { witness.advanceError = error; }
    witness.afterElapsed=A.elapsedSeconds; witness.afterDisposed=handle.isDisposed;
  },{once:true});
  scope.dispose();
  assert.equal(witness.state,'closing'); assert.equal(witness.beforeDisposed,false); assert.equal(witness.failures.length,3);
  for (const error of witness.failures) assert.equal(error.code,'F1_CLOCK_SCOPE_CLOSED');
  assert.equal(witness.advanceError,undefined); assert.deepEqual(witness.tick,{tickId:2,elapsedSeconds:.375,deltaSeconds:.125});
  assert.equal(witness.beforeElapsed,.25); assert.equal(witness.afterElapsed,.25); assert.equal(witness.afterDisposed,true); sameGeometry(saved);
  assert.equal(scope.state,'closed'); assert.equal(clock.elapsedSeconds,.375); assert.equal(B.elapsedSeconds,.375);
  A.step(.25); pose(sdk,oracle,A,.5,page); const replacement=bind(A,engine.createScope()); assert.notEqual(replacement,handle);
}));

test('F1C07 owner termination retires bindings before core/display/page release', { timeout:15000 }, async () => {
  for (const target of ['instance','instanceScope','resourceScope','resources','engine']) await ownedSession(async context => {
    const { sdk,engine,clock } = context; let owned, closePromise, pageWitness, abortWitness;
    const observer = engine.createScope();
    clock.onTick(observer,()=>{
      if (target==='instance') owned.A.dispose();
      if (target==='instanceScope') owned.scopeA.dispose();
      if (target==='resourceScope') owned.resourceScope.dispose();
      if (target==='resources') owned.resources.dispose();
      if (target==='engine') { closePromise=engine.dispose(); assert.equal(engine.dispose(),closePromise); }
      return undefined;
    });
    let saved;
    owned=await originalInstances(context,{onPageDispose(){pageWitness=reentry(owned.A,saved);}});
    const { A,B,p,page,resources,resourceScope,scopeA }=owned, a=bind(A,engine.createScope()), b=bind(B,engine.createScope());saved=retained(sdk,A);
    const abortScope=target==='instanceScope'?scopeA:target==='resourceScope'?resourceScope:undefined;
    abortScope?.signal.addEventListener('abort',()=>{
      abortWitness={state:abortScope.state,...reentry(A,saved)};
    },{once:true});
    sample(sdk,engine,0); assert.deepEqual(sample(sdk,engine,.25),{tickId:1,elapsedSeconds:.25,deltaSeconds:.25});
    assert.equal(A.elapsedSeconds,0); assert.equal(a.isDisposed,true);
    for(const row of saved)assert.deepEqual(geometryValues(row.geometry),row.values);
    if(target==='instance'||target==='instanceScope'){
      assert.equal(B.elapsedSeconds,.25); assert.equal(b.isDisposed,false); assert.equal(p.disposedPages.length,0); assert.equal(page.isDisposed,false);
      errorCode(sdk,()=>A.step(NaN),target==='instance'?'F1_INSTANCE_TERMINAL':'F1_SCOPE_CLOSED');
    }else{assert.equal(B.elapsedSeconds,0);assert.equal(b.isDisposed,true);}
    if(abortScope!==undefined){assert.equal(abortWitness.state,'closing');assert.equal(abortWitness.elapsedBefore,0);reentryUnchanged(abortWitness,'F1_SCOPE_CLOSED');}
    if(closePromise!==undefined)await closePromise;
    resources.dispose();
    assert.equal(A.display.isDisposed,true);assert.equal(B.display.isDisposed,true);assert.equal(a.isDisposed,true);assert.equal(b.isDisposed,true);counts(p);
    assert.equal(pageWitness.elapsedBefore,0);reentryUnchanged(pageWitness,'F1_RESOURCES_TERMINAL');
    for(const row of saved)assert.deepEqual(geometryValues(row.geometry),row.values);
  });
});

test('F1C08 binding in dispatch waits next snapshot; frame reentry stays guarded', { timeout:15000 }, async () => ownedSession(async context => {
  const { sdk,helpers,engine,clock,oracle }=context, { A,page }=await originalInstances(context);
  const otherHost=helpers.host(), other=await sdk.createEngine({host:otherHost.adapter});
  let handle, calls=0, frameReads=0;
  sample(sdk,other,4);
  try{
    clock.onTick(engine.createScope(),()=>{
      calls++;if(handle===undefined)handle=bind(A,engine.createScope());
      const unread={get width(){frameReads++;throw new Error('frame read');}};
      for(const method of ['captureFrame','renderFrame','captureTexturedFrame','renderTexturedFrame'])errorCode(sdk,()=>engine[method](unread),'CLOCK_REENTRANT');
      errorCode(sdk,()=>sample(sdk,engine,NaN),'CLOCK_REENTRANT');
      sample(sdk,other,4+calls*.125);return undefined;
    });
    sample(sdk,engine,0);sample(sdk,engine,.125);assert.equal(A.elapsedSeconds,0);
    for(const source of [.25,.375,.5,.625])sample(sdk,engine,source);
    pose(sdk,oracle,A,.5,page);assert.equal(calls,5);assert.equal(frameReads,0);assert.equal(other.clock.elapsedSeconds,.625);
    const saved=retained(sdk,A);engine.stage.addChild(A.display);engine.renderTexturedFrame(options);engine.captureTexturedFrame(options);sameGeometry(saved);
    assert.equal(A.elapsedSeconds,.5);assert.equal(clock.elapsedSeconds,.625);
  }finally{await other.dispose();}
}));

test('F1C09 reviewed owned-copy after-advance fault retires A; B remains independent', { timeout:15000 }, async t => {
  await inputs();
  const admission=manifest.clock.faultControl;
  if(admission.status!=='ACTUAL_OWNED_NAMED_FAULT_READY'||admission.receipt===null){
    t.skip('PENDING exact owned named-fault actor and fresh actual bootstrap; not accepted10/10');return;
  }
  // The fixed first-party contract records truthful original review provenance.
  // Only this invocation's raw baselines and executed actor may admit the fault.
  const actor=JSON.parse((await pin(admission.receipt)).toString('utf8'));
  assert.equal(actor.schemaVersion,1);assert.equal(actor.kind,'CURRENT_RUN_OWNED_CLOCK_ACTOR');
  assert.equal(actor.status,'ACTUAL_OWNED_NAMED_FAULT_READY');assert.equal(actor.faultName,'F1_INJECTED_AFTER_ADVANCE');assert.equal(actor.deltaSeconds,.25);
  assert.equal(actor.stage,'AFTER_POSITIVE_CORE_UPDATE_APPLY_WORLD_BEFORE_MATERIALIZE');
  assert.equal(actor.contract.bytes,manifest.clock.acceptanceContract.bytes);assert.equal(actor.contract.sha256,manifest.clock.acceptanceContract.sha256);
  const contract=JSON.parse((await pin(actor.contract)).toString('utf8'));
  assert.equal(contract.schemaVersion,1);assert.equal(contract.kind,'FIRST_PARTY_FIXED_CLOCK_ACCEPTANCE_CONTRACT');
  assert.equal(actor.source.bytes,contract.source.bytes);assert.equal(actor.source.sha256,contract.source.sha256);await pin(actor.source);
  await completedBaseline(actor.baselines.manual,12,0,actor.mutationStartedAtUTC);
  await completedBaseline(actor.baselines.clockOriginal,9,1,actor.mutationStartedAtUTC);
  assert.equal(actor.baselineAcceptance.manualPassed,12);assert.equal(actor.baselineAcceptance.manualFailed,0);
  assert.equal(actor.baselineAcceptance.clockOriginalPassed,9);assert.equal(actor.baselineAcceptance.clockOriginalFailed,0);assert.equal(actor.baselineAcceptance.beforeMutation,true);
  assert.equal(actor.restoration.inverseUnique,true);await pin(actor.restoration.restoredOriginalPin);
  const restored=JSON.parse((await pin(actor.restoration.restoredOriginalClock)).toString('utf8'));
  assert.equal(restored.exitCode,0);assert.equal(restored.timeout,false);assert.equal(restored.signal,null);
  const restoredOut=(await pin(restored.stdout)).toString('utf8');assert.equal((await pin(restored.stderr)).length,0);
  assert.match(restoredOut,/^# pass 9\r?$/m);assert.match(restoredOut,/^# fail 0\r?$/m);assert.match(restoredOut,/^# skipped 1\r?$/m);
  const original=(await pin(actor.originalEmission)).toString('utf8'), edited=(await pin(actor.actorEmission)).toString('utf8');
  assert.equal(actor.originalEmission.bytes,contract.expectedEmission.bytes);assert.equal(actor.originalEmission.sha256,contract.expectedEmission.sha256);
  assert.equal(actor.actorEmission.bytes,contract.fault.recordedEditedPin.bytes);assert.equal(actor.actorEmission.sha256,contract.fault.recordedEditedPin.sha256);
  assert.equal(await realpath(actor.originalEmission.path),await realpath(new URL('out/f1-manual-bridge.js',root)));
  assert.notEqual(actor.originalEmission.path,actor.actorEmission.path);assert.equal(actor.hunk.occurrences,1);
  assert.equal(typeof actor.hunk.before,'string');assert.ok(actor.hunk.before.length>0);assert.equal(typeof actor.hunk.after,'string');
  assert.equal(actor.hunk.before,contract.fault.before);assert.equal(actor.hunk.after,contract.fault.after);
  assert.equal(original.split(actor.hunk.before).length-1,1);assert.equal(original.replace(actor.hunk.before,actor.hunk.after),edited);
  assert.ok(actor.hunk.after.includes('F1_INJECTED_AFTER_ADVANCE'));
  assert.equal(await realpath(resolve(actor.actorRoot,'node_modules/@egret/engine')),await realpath(resolve(dirname(manifest.sdkGraph.engineEntry),'..')));
  assert.equal(await realpath(resolve(actor.actorRoot,'node_modules/@esotericsoftware/spine-core')),await realpath(manifest.clock.externalCore.root));
  const mutant=await import(pathToFileURL(actor.actorEmission.path).href);assert.equal(typeof mutant.createF1ClockSession,'function');
  await ownedSession(async context=>{
    const { sdk,engine,clock,oracle }=context,{ A,B,p,page }=await originalInstances(context);
    const a=bind(A,engine.createScope()),b=bind(B,engine.createScope()),saved=retained(sdk,A);
    sample(sdk,engine,0);const failure=errorCode(sdk,()=>sample(sdk,engine,.25),'CLOCK_CALLBACK_FAILED');
    assert.equal(failure.cause.message,'F1_INJECTED_AFTER_ADVANCE');assert.deepEqual(clockView(clock),{state:'running',elapsed:.25,tick:1});
    assert.equal(A.elapsedSeconds,0);assert.equal(B.elapsedSeconds,0);sameGeometry(saved);assert.equal(a.isDisposed,true);assert.equal(b.isDisposed,false);
    errorCode(sdk,()=>A.step(.125),'F1_INSTANCE_TERMINAL');sameGeometry(saved);
    for(const source of [.375,.5,.625,.75])sample(sdk,engine,source);
    pose(sdk,oracle,B,.5,page);assert.equal(A.elapsedSeconds,0);assert.equal(page.isDisposed,false);assert.equal(p.disposedPages.length,0);
    assert.deepEqual(clockView(clock),{state:'running',elapsed:.75,tick:5});
  },undefined,mutant.createF1ClockSession);
});
