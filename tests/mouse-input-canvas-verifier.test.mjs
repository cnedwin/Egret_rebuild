// Collector grammar/evidence units only; these are not browser or SDK acceptance. Apache-2.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { CONTROLS, CONTEXT_IDS, ROW_IDS, POINTS, INITIAL_RGBA, EXAMPLE_IMPORTS, projectControl, restoreControlRoute, projectImportMap, classifyConsole, inspectRows, classifyContext, admitCollection } from '../tools/mouse-input-canvas-contract.mjs';
import { sealGraph } from '../tools/sequence-player/file-graph.mjs';

test('six controls have one distinct assigned contract and exact reversible logic fragments', () => {
  assert.deepEqual(CONTEXT_IDS, ['baseline', 'OMIT_BEGIN', 'RETARGET_END', 'OMIT_Q2', 'CANVAS_ONLY_CSS', 'DPR_MULTIPLY', 'OMIT_PHYSICAL_REMOVE']);
  assert.deepEqual(CONTROLS.map(row => row.witness), ['BEGIN_ROUTE', 'END_TARGET', 'ACTIVATION_SUPPRESSED', 'CSS_REFUSAL', 'WRONG_X_PAYLOAD_B03', 'PHYSICAL_REMOVAL']);
  for (const control of CONTROLS) {
    const original = '// syntax fixture, not product execution\n' + control.anchor + '\n';
    const projected = projectControl(control.id, original, original, original);
    for (const role of ['source', 'emitted', 'served']) {
      assert.notEqual(projected[role].originalSHA256, projected[role].projectedSHA256);
      assert.equal(projected[role].originalSHA256, projected[role].restoredSHA256);
    }
  }
});
test('missing, repeated and unknown control anchors are preparation errors', () => {
  for (const control of CONTROLS) {
    assert.throws(() => projectControl(control.id, '', control.anchor, control.anchor), /Unique control anchor/);
    assert.throws(() => projectControl(control.id, control.anchor, control.anchor + control.anchor, control.anchor), /Unique control anchor/);
    assert.throws(() => projectControl(control.id, control.anchor, control.anchor, ''), /Unique control anchor/);
  }
  assert.throws(() => projectControl('unknown', '', '', ''), /Unknown MI1 control/);
});
test('physical-removal control skips only acquisition slot one and DPR control changes only X', () => {
  assert.equal(CONTROLS[5].replacement, 'if (record.pairs.indexOf(pair) !== 1) pair.remove(pair.listener);');
  assert.equal(CONTROLS[4].replacement, 'const globalX = (x - rect.left) * width / rect.width * win.devicePixelRatio;');
});
test('exact public entries and four transitive emitted aliases can be projected', () => {
  const original = { imports: EXAMPLE_IMPORTS };
  const html = '<script type="importmap">' + JSON.stringify(original) + '</script>';
  const imports = Object.fromEntries(Object.keys(EXAMPLE_IMPORTS).map((name, index) => [name, '/m/' + String(index).padStart(4, '0') + '.js']));
  assert.deepEqual(Object.keys(EXAMPLE_IMPORTS), ['@egret/engine', '@egret/engine/web', '@egret/engine/web/input', '@egret/runtime', '@egret/contracts', '#egret-textured-frame-state', '#egret-mouse-input']);
  assert.equal(EXAMPLE_IMPORTS['@egret/runtime'], '../../packages/runtime/dist/index.js');
  assert.equal(EXAMPLE_IMPORTS['@egret/contracts'], '../../packages/contracts/dist/index.js');
  assert.equal(EXAMPLE_IMPORTS['#egret-textured-frame-state'], '../../packages/engine/dist/internal/texturedFrameState.js');
  assert.equal(EXAMPLE_IMPORTS['#egret-mouse-input'], '../../packages/engine/dist/mouseInput.js');
  assert.equal(projectImportMap(html, imports).html, '<script type="importmap">' + JSON.stringify({ imports }) + '</script>');
  assert.throws(() => projectImportMap(html + html, imports), /Exact public import-map/);
  assert.throws(() => projectImportMap(html, { ...imports, '@egret/engine/': '/m/0007.js' }), /Exact public import-map/);
  const missing = { ...imports }; delete missing['#egret-mouse-input'];
  assert.throws(() => projectImportMap(html, missing), /Exact public import-map/);
  const altered = '<script type="importmap">' + JSON.stringify({ imports: { ...EXAMPLE_IMPORTS, '@egret/runtime': '../../packages/engine/dist/index.js' } }) + '</script>';
  assert.throws(() => projectImportMap(altered, imports), /Exact public import-map/);
  assert.throws(() => projectImportMap(html, { ...imports, '@egret/engine/web/input': 'https://example.test/' }), /Exact public import-map/);
});

// Synthetic admission grammar only. This fixture is never native behavior evidence.
function dprAdmissionFixture() {
  const rows = ROW_IDS.map(id => ({ id, samples: INITIAL_RGBA.map((rgba, index) => ({ point: POINTS[index], rgba })) }));
  const pairKinds = [['abort', 'signal', 'abort', null], ['native', 'canvas', 'pointerdown', false], ['native', 'window', 'pointerup', true], ['native', 'window', 'pointercancel', true], ['native', 'window', 'blur', false], ['native', 'window', 'pagehide', false]];
  rows[0].geometry = { logical: [160, 100], css: [320, 200], viewport: [900, 700], deviceScaleFactor: 2 };
  rows[0].snapshot = { phase: 'ready', generation: 1, state: 'idle', scopeState: 'open', liveNodes: 5, disposedNodes: 0, renderCount: 1, lastFrameId: 1, pendingHostTimers: 0, setupFailure: null, diagnosticOverflow: false, overflow: false, log: [], diagnostics: [] };
  rows[0].ledger = { overflow: false, unmatchedRemoves: 0, pairs: pairKinds.map(([kind, target, type, capture]) => ({ generation: 1, kind, target, type, capture, addAttempts: 1, addSucceeded: true, removeAttempts: 0, removeSucceeded: false, once: kind === 'abort', frozenOptions: kind === 'abort' })) };
  const visits = [['stage', 'capturing'], ['panel', 'capturing'], ['back', 'atTarget'], ['back', 'atTarget'], ['panel', 'bubbling'], ['stage', 'bubbling']];
  const group = kind => visits.map(([currentTarget, phase]) => ({ kind, currentTarget, target: 'back', phase, state: kind === 'begin' ? 'pressed' : 'idle', globalX: 50, globalY: 25, pointerType: 'mouse', button: 0, pointerId: 7, frozenEvent: true, frozenPayload: true }));
  const input = kind => ({ method: 'page.mouse.move+' + kind, button: 'left', logical: [25, 25], page: [50, 50], box: { x: 0, y: 0, width: 320, height: 200 } });
  rows[2].down = { input: input('down'), snapshot: { state: 'pressed', renderCount: 1, log: group('begin') } };
  rows[2].up = { input: input('up'), snapshot: { state: 'idle', renderCount: 1, log: [...group('begin'), ...group('end'), ...group('activate')] } };
  return { id: 'DPR_MULTIPLY', rows, errors: [], overflow: false, cleanup: { applicationClosed: true, pageClosed: true, contextClosed: true, observerRestored: true, pendingActors: 0 } };
}
test('DPR sensitivity requires complete B03 observed wrong X and retains generic validation', () => {
  const context = dprAdmissionFixture(), admitted = classifyContext(context);
  assert.equal(admitted.status, 'PASS_ASSIGNED_CONTROL_SENSITIVITY');
  assert.equal(admitted.witness, 'WRONG_X_PAYLOAD_B03');
  assert.ok(admitted.issues.some(issue => issue.row === 'B03' && issue.code === 'LOGICAL_POINT'));
  assert.ok(admitted.issues.some(issue => issue.row === 'B03' && issue.code === 'WRONG_X_PAYLOAD_B03'));
});
test('empty, missing or malformed groups cannot qualify as DPR payload sensitivity', () => {
  const mutations = [
    row => { row.down.snapshot.log = []; },
    row => { row.up.snapshot.log = []; },
    row => { row.up.snapshot.log = row.up.snapshot.log.filter(entry => entry.kind !== 'end'); },
    row => { row.up.snapshot.log[0].globalX = NaN; },
    row => { row.up.snapshot.log[0].globalY = 50; },
    row => { row.up.snapshot.log[0].pointerId = 8; },
    row => { row.up.snapshot.log[0].frozenPayload = false; },
    row => { row.up.snapshot.log[0].target = 'upper'; },
  ];
  for (const mutate of mutations) {
    const context = dprAdmissionFixture(); mutate(context.rows[2]);
    const admitted = classifyContext(context);
    assert.equal(admitted.status, 'FAIL_ASSIGNED_CONTROL_SENSITIVITY');
    assert.equal(admitted.issues.some(issue => issue.code === 'WRONG_X_PAYLOAD_B03'), false);
  }
  const missing = dprAdmissionFixture(); delete missing.rows[2].down; delete missing.rows[2].up;
  const admitted = classifyContext(missing);
  assert.equal(admitted.status, 'FAIL_ASSIGNED_CONTROL_SENSITIVITY');
  assert.ok(admitted.issues.some(issue => issue.code === 'LOGICAL_POINT'));
});
test('projection preparation failure preserves its original cause while restoring an acquired route', async () => {
  const original = { bytes: Buffer.from('acquired original') }, routes = new Map([['/m/0000.js', original]]);
  let projection, initialCause;
  assert.throws(() => {
    try { projection = projectControl('OMIT_BEGIN', '', CONTROLS[0].anchor, CONTROLS[0].anchor); }
    catch (cause) { initialCause = cause; throw cause; }
    finally { restoreControlRoute(routes, '/m/0000.js', original, projection); }
  }, cause => cause === initialCause && cause.message === 'Unique control anchor missing: OMIT_BEGIN/source');
  assert.equal(routes.get('/m/0000.js'), original); assert.equal(projection, undefined);
  const report = { runnerFailure: { present: true, kind: 'object', text: String(initialCause) } };
  assert.equal((await admitCollection(report, async () => new Uint8Array())).status, 'INCOMPLETE');
  assert.equal(report.runnerFailure.text, 'Error: Unique control anchor missing: OMIT_BEGIN/source');
});
test('incomplete collection cannot qualify as assigned control sensitivity', () => {
  const partial = { id: 'OMIT_BEGIN', rows: [], errors: [], overflow: false, cleanup: { applicationClosed: true, pageClosed: true, contextClosed: true, observerRestored: true, pendingActors: 0 } };
  assert.equal(classifyContext(partial).status, 'INCOMPLETE');
  assert.equal(inspectRows([]).complete, false);
  assert.equal(inspectRows(ROW_IDS.map(id => ({ id }))).setupComplete, false);
});
test('literal scene, geometry and pixel recipes are independent constants', () => {
  assert.deepEqual(POINTS, [[50, 40], [25, 25], [140, 90]]);
  assert.deepEqual(INITIAL_RGBA, [[0, 255, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]]);
  assert.equal(ROW_IDS.length, 11);
});
test('console warnings and errors stay fatal apart from one exact readback advisory', () => {
  assert.equal(classifyConsole('log', 'ordinary'), undefined);
  assert.equal(classifyConsole('warning', 'unexpected').bucket, 'errors');
  assert.equal(classifyConsole('error', 'unexpected').bucket, 'errors');
});
test('missing evidence and forged artifact identity return INCOMPLETE', async () => {
  assert.equal((await admitCollection({}, async () => new Uint8Array())).status, 'INCOMPLETE');
  const body = Buffer.from('not the declared bytes'), sha256 = createHash('sha256').update('different').digest('hex');
  const context = { id: 'baseline', contextId: 'unique', artifacts: ['before', 'after', 'rows', 'rgba'].map(kind => ({ kind, path: 'baseline.' + kind, bytes: body.length, sha256 })), rows: [] };
  const result = await admitCollection({ contexts: [context] }, async () => body);
  assert.equal(result.status, 'INCOMPLETE');
  assert.ok(result.issues.some(issue => issue.code === 'ARTIFACT_UNAVAILABLE'));
});

async function graphFixture(run) {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'egret-mi1-graph-'));
  try {
    const dir = path.join(fixture, 'packages/engine'); await mkdir(path.join(dir, 'dist'), { recursive: true }); await mkdir(path.join(dir, 'src'), { recursive: true });
    await writeFile(path.join(dir, 'src/index.ts'), '// Tool lexical fixture only.\n');
    await writeFile(path.join(dir, 'src/mouseInput.ts'), '// Tool lexical fixture only.\n');
    await writeFile(path.join(dir, 'dist/mouseInput.js'), 'export const lexicalFixture = 1;\n');
    await run({ fixture, entry: path.join(dir, 'dist/index.js'), target: path.join(dir, 'dist/mouseInput.js') });
  } finally {
    const resolved = path.resolve(fixture).toLowerCase(), parent = path.resolve(os.tmpdir()).toLowerCase() + path.sep;
    if (!resolved.startsWith(parent) || !path.basename(fixture).startsWith('egret-mi1-graph-')) throw new Error('Fixture cleanup target escaped its temporary parent');
    await rm(fixture, { recursive: true, force: true });
  }
}
test('shared graph admits exactly the selected package-private mouse alias', async () => graphFixture(async ({ fixture, entry, target }) => {
  await writeFile(entry, "import { lexicalFixture } from '#egret-mouse-input';\nexport { lexicalFixture };\n");
  const graph = await sealGraph({ repositoryRoot: fixture, entryPaths: { canvas: [entry] }, aliases: { '#egret-mouse-input': target } });
  assert.equal(graph.modules.length, 2); assert.equal(graph.modules[0].edges[0].specifier, '#egret-mouse-input');
}));
test('shared graph refuses absent alias selection and unknown alias prefixes', async () => graphFixture(async ({ fixture, entry, target }) => {
  await writeFile(entry, "import { lexicalFixture } from '#egret-mouse-input';\n");
  await assert.rejects(sealGraph({ repositoryRoot: fixture, entryPaths: { canvas: [entry] }, aliases: {} }), /Unselected bare import/);
  await writeFile(entry, "import { lexicalFixture } from '#egret-mouse-input-extra';\n");
  await assert.rejects(sealGraph({ repositoryRoot: fixture, entryPaths: { canvas: [entry] }, aliases: { '#egret-mouse-input-extra': target } }), /simple literal path/);
}));
