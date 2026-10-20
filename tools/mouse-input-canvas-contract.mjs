// Independent first-party finite native evidence admission. Apache-2.0.
import { createHash } from 'node:crypto';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const CONTROLS = Object.freeze([
  { id: 'OMIT_BEGIN', source: 'packages/engine/src/mouseInput.ts', emitted: 'packages/engine/dist/mouseInput.js',
    anchor: 'const allowed = operations.dispatch(target, inputEvent(record.events.begin, payload(id, point)), record.maximum);',
    replacement: 'const allowed = true;', witness: 'BEGIN_ROUTE' },
  { id: 'RETARGET_END', source: 'packages/engine/src/mouseInput.ts', emitted: 'packages/engine/dist/mouseInput.js',
    anchor: 'const endAllowed = operations.dispatch(held.target, inputEvent(record.events.end, payload(id, point)), record.maximum);',
    replacement: 'const endAllowed = operations.dispatch(first ?? held.target, inputEvent(record.events.end, payload(id, point)), record.maximum);', witness: 'END_TARGET' },
  { id: 'OMIT_Q2', source: 'packages/engine/src/mouseInput.ts', emitted: 'packages/engine/dist/mouseInput.js',
    anchor: 'const second = operations.pick(point.x, point.y, record.maximum);', replacement: 'const second = first;', witness: 'ACTIVATION_SUPPRESSED' },
  { id: 'CANVAS_ONLY_CSS', source: 'packages/engine/web/MouseInput.ts', emitted: 'packages/engine/dist/web/MouseInput.js',
    anchor: 'while (current !== document) {', replacement: 'while (current !== document && seen.size < 1) {', witness: 'CSS_REFUSAL' },
  { id: 'DPR_MULTIPLY', source: 'packages/engine/web/MouseInput.ts', emitted: 'packages/engine/dist/web/MouseInput.js',
    anchor: 'const globalX = (x - rect.left) * width / rect.width;', replacement: 'const globalX = (x - rect.left) * width / rect.width * win.devicePixelRatio;', witness: 'WRONG_X_PAYLOAD_B03' },
  { id: 'OMIT_PHYSICAL_REMOVE', source: 'packages/engine/src/mouseInput.ts', emitted: 'packages/engine/dist/mouseInput.js',
    anchor: 'pair.remove(pair.listener);', replacement: 'if (record.pairs.indexOf(pair) !== 1) pair.remove(pair.listener);', witness: 'PHYSICAL_REMOVAL' },
].map(Object.freeze));
export const CONTEXT_IDS = Object.freeze(['baseline', ...CONTROLS.map(row => row.id)]);
export const ROW_IDS = Object.freeze(Array.from({ length: 11 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')));
export const POINTS = Object.freeze([[50, 40], [25, 25], [140, 90]].map(Object.freeze));
export const INITIAL_RGBA = Object.freeze([[0, 255, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255]].map(Object.freeze));
const COVER_RGBA = [[0, 0, 255, 255], [255, 0, 0, 255], [0, 0, 0, 255]];

/** One logic replacement, separately bound to source, emitted and served copies. */
export function projectControl(id, source, emitted, served) {
  const rule = CONTROLS.find(row => row.id === id);
  if (!rule) throw new Error('Unknown MI1 control: ' + id);
  const project = (text, role) => {
    if (typeof text !== 'string' || text.split(rule.anchor).length - 1 !== 1) throw new Error('Unique control anchor missing: ' + id + '/' + role);
    const copy = text.replace(rule.anchor, rule.replacement);
    if (copy.split(rule.replacement).length - 1 !== 1 || copy.replace(rule.replacement, rule.anchor) !== text) throw new Error('Exact inverse restoration failed: ' + id + '/' + role);
    return { text: copy, originalSHA256: hash(text), projectedSHA256: hash(copy), restoredSHA256: hash(copy.replace(rule.replacement, rule.anchor)) };
  };
  return { id, source: project(source, 'source'), emitted: project(emitted, 'emitted'), served: project(served, 'served'), rule };
}

/** Restore an acquired route even when preparation failed before producing a projection. */
export function restoreControlRoute(routes, route, original, projection) {
  if (!original) return;
  routes.set(route, original);
  if (projection) projection.servedCopyRestored = hash(routes.get(route).bytes) === projection.served.originalSHA256;
}

// Application JavaScript imports three public entries; these five exact transitive
// aliases allow the ordinary repository-root HTTP example to resolve emitted SDK code.
export const EXAMPLE_IMPORTS = Object.freeze({
  '@egret/engine': '../../packages/engine/dist/index.js',
  '@egret/engine/web': '../../packages/engine/dist/web/index.js',
  '@egret/engine/web/input': '../../packages/engine/dist/web/input.js',
  '@egret/runtime': '../../packages/runtime/dist/index.js',
  '@egret/contracts': '../../packages/contracts/dist/index.js',
  '@egret/contracts/resources': '../../packages/contracts/dist/resources/index.js',
  '#egret-textured-frame-state': '../../packages/engine/dist/internal/texturedFrameState.js',
  '#egret-mouse-input': '../../packages/engine/dist/mouseInput.js',
});

/** Admit exactly the example's three public entries and five transitive aliases. */
export function projectImportMap(html, imports) {
  const matches = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  const expected = EXAMPLE_IMPORTS;
  if (matches.length !== 1 || !same(JSON.parse(matches[0][1]), { imports: expected }) || !same(Object.keys(imports).sort(), Object.keys(expected).sort()) || Object.values(imports).some(value => !/^\/m\/\d{4}\.js$/.test(value))) throw new Error('Exact public import-map admission failed');
  return { html: html.replace(matches[0][0], '<script type="importmap">' + JSON.stringify({ imports }) + '</script>'), original: { imports: expected }, served: { imports } };
}

const readbackWarning = 'Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently';
export function classifyConsole(type, message) {
  if (type !== 'warning' && type !== 'error') return undefined;
  return type === 'warning' && message === readbackWarning ? { bucket: 'advisories', kind: 'CANVAS_READBACK_ADVISORY', message } : { bucket: 'errors', kind: 'CONSOLE_' + type.toUpperCase(), message };
}

function check(issues, row, code, actual, expected) { if (!same(actual, expected)) issues.push({ row, code, actual, expected }); }
function route(target) { return [['stage', 'capturing'], ['panel', 'capturing'], [target, 'atTarget'], [target, 'atTarget'], ['panel', 'bubbling'], ['stage', 'bubbling']]; }
function nativeInput(input, point, kind, row, issues) {
  check(issues, row, 'NATIVE_METHOD', [input?.method, input?.button, input?.logical], ['page.mouse.move+' + kind, 'left', point]);
  const box = input?.box;
  if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width !== 320 || box.height !== 200) issues.push({ row, code: 'NATIVE_GEOMETRY' });
  else check(issues, row, 'NATIVE_CSS_POSITION', input?.page, [box.x + point[0] * 2, box.y + point[1] * 2]);
}
function eventGroup(log, kind, target, point, state, row, code, issues) {
  const actual = (Array.isArray(log) ? log : []).filter(entry => entry.kind === kind);
  check(issues, row, code, actual.map(entry => [entry.currentTarget, entry.target, entry.phase, entry.state]), route(target).map(([current, phase]) => [current, target, phase, state]));
  check(issues, row, 'LOGICAL_POINT', actual.map(entry => [entry.globalX, entry.globalY, entry.pointerType, entry.button]), Array.from({ length: 6 }, () => [point[0], point[1], 'mouse', 0]));
  if (actual.some(entry => !Number.isSafeInteger(entry.pointerId) || entry.pointerId < 0 || entry.pointerId !== actual[0]?.pointerId || entry.frozenEvent !== true || entry.frozenPayload !== true)) issues.push({ row, code: 'EVENT_IDENTITY_SCALARS' });
}
function eventRow(row, target, downPoint, upPoint, activate, issues) {
  const id = row.id;
  nativeInput(row.down?.input, downPoint, 'down', id, issues); nativeInput(row.up?.input, upPoint, 'up', id, issues);
  check(issues, id, 'DOWN_STATE', row.down?.snapshot?.state, 'pressed');
  check(issues, id, 'UP_STATE', row.up?.snapshot?.state, 'idle');
  eventGroup(row.down?.snapshot?.log, 'begin', target, downPoint, 'pressed', id, 'BEGIN_ROUTE', issues);
  eventGroup(row.up?.snapshot?.log, 'end', target, upPoint, 'idle', id, 'END_TARGET', issues);
  if (activate) eventGroup(row.up?.snapshot?.log, 'activate', target, upPoint, 'idle', id, 'ACTIVATE_ROUTE', issues);
  else check(issues, id, 'ACTIVATION_SUPPRESSED', row.up?.snapshot?.log?.filter(entry => entry.kind === 'activate'), []);
  const expectedKinds = ['begin', 'end', ...(activate ? ['activate'] : [])];
  check(issues, id, 'EVENT_INVENTORY', row.up?.snapshot?.log?.map(entry => entry.kind), expectedKinds.flatMap(kind => Array(6).fill(kind)));
  const ids = row.up?.snapshot?.log?.map(entry => entry.pointerId) ?? [];
  if (ids.length && ids.some(value => value !== ids[0])) issues.push({ row: id, code: 'PRESS_POINTER_ID' });
  for (const part of ['down', 'up']) check(issues, id, 'NO_IMPLICIT_REPAINT', row[part]?.snapshot?.renderCount, 1);
}

/** DPR sensitivity requires observed wrong X on the complete back-only episode. */
function wrongXPayloadB03(row) {
  const down = row?.down?.snapshot?.log, up = row?.up?.snapshot?.log;
  if (row?.id !== 'B03' || !Array.isArray(down) || down.length !== 6 || !Array.isArray(up) || up.length !== 18 || !same(up.slice(0, 6), down)) return false;
  const retained = [];
  eventRow(row, 'back', [25, 25], [25, 25], true, retained);
  // Generic LOGICAL_POINT includes absent groups; it cannot itself qualify a control.
  return retained.every(issue => issue.code === 'LOGICAL_POINT') && [...down, ...up].every(entry =>
    Number.isFinite(entry.globalX) && Number.isFinite(entry.globalY) && entry.globalX === 50 && entry.globalY === 25);
}

function pairIssues(ledger, generation, removed, issues, row, code) {
  const pairs = ledger?.pairs?.filter(pair => pair.generation === generation) ?? [];
  const expected = [['abort', 'signal', 'abort', null], ['native', 'canvas', 'pointerdown', false], ['native', 'window', 'pointerup', true], ['native', 'window', 'pointercancel', true], ['native', 'window', 'blur', false], ['native', 'window', 'pagehide', false]];
  check(issues, row, code, pairs.map(pair => [pair.kind, pair.target, pair.type, pair.capture]), expected);
  if (pairs.some(pair => pair.addAttempts !== 1 || pair.addSucceeded !== true || pair.removeAttempts !== (removed ? 1 : 0) || pair.removeSucceeded !== removed || (removed && pair.removeOptionsMatched !== true))) issues.push({ row, code, generation });
  const abort = pairs[0];
  if (abort?.once !== true || abort?.frozenOptions !== true) issues.push({ row, code, reason: 'ORIGINAL_FROZEN_ONCE_ABORT' });
  if (ledger?.overflow !== false || ledger?.unmatchedRemoves !== 0) issues.push({ row, code, reason: 'PAIR_LEDGER_INTEGRITY' });
}

/** Literal observations remain independent of the application's selection algorithm. */
export function inspectRows(rows) {
  const issues = [], setupIssues = [];
  if (!Array.isArray(rows) || !same(rows.map(row => row?.id), ROW_IDS)) return { complete: false, setupComplete: false, issues: [{ code: 'ROW_INVENTORY' }] };
  const byId = Object.fromEntries(rows.map(row => [row.id, row])), ready = byId.B01;
  check(setupIssues, 'B01', 'READY_GEOMETRY', ready.geometry, { logical: [160, 100], css: [320, 200], viewport: [900, 700], deviceScaleFactor: 2 });
  for (const [key, expected] of Object.entries({ phase: 'ready', generation: 1, state: 'idle', scopeState: 'open', liveNodes: 5, disposedNodes: 0, renderCount: 1, lastFrameId: 1, pendingHostTimers: 0, setupFailure: null, diagnosticOverflow: false, overflow: false })) check(setupIssues, 'B01', 'READY_' + key, ready.snapshot?.[key], expected);
  check(setupIssues, 'B01', 'READY_LOG', ready.snapshot?.log, []); check(setupIssues, 'B01', 'READY_DIAGNOSTICS', ready.snapshot?.diagnostics, []);
  check(setupIssues, 'B01', 'READY_PIXELS', ready.samples?.map(sample => sample.rgba), INITIAL_RGBA);
  pairIssues(ready.ledger, 1, false, setupIssues, 'B01', 'READY_PAIRS');
  issues.push(...setupIssues);
  eventRow(byId.B02, 'upper', [50, 40], [50, 40], true, issues);
  eventRow(byId.B03, 'back', [25, 25], [25, 25], true, issues);
  if (wrongXPayloadB03(byId.B03)) issues.push({ row: 'B03', code: 'WRONG_X_PAYLOAD_B03', observed: [50, 25], expected: [25, 25] });
  eventRow(byId.B04, 'upper', [50, 40], [25, 25], false, issues);
  for (const phase of ['down', 'up']) { check(issues, 'B05', 'MISS_STATE', byId.B05[phase]?.snapshot?.state, 'idle'); check(issues, 'B05', 'MISS_LOG', byId.B05[phase]?.snapshot?.log, []); check(issues, 'B05', 'NO_IMPLICIT_REPAINT', byId.B05[phase]?.snapshot?.renderCount, 1); }
  nativeInput(byId.B05.down?.input, [140, 90], 'down', 'B05', issues); nativeInput(byId.B05.up?.input, [140, 90], 'up', 'B05', issues);
  eventRow(byId.B06, 'upper', [50, 40], [50, 40], false, issues);
  check(issues, 'B06', 'END_REVEALS_COVER', byId.B06.up?.snapshot?.coverVisible, true);
  check(issues, 'B07', 'EXPLICIT_RENDER', [byId.B07.snapshot?.renderCount, byId.B07.snapshot?.lastFrameId], [2, 2]);
  check(issues, 'B08', 'EXPLICIT_DISPOSE_STATE', byId.B08.disposed?.state, 'closed');
  check(issues, 'B08', 'BORROWED_OWNERS_RETAINED', [byId.B08.disposed?.scopeState, byId.B08.disposed?.liveNodes, byId.B08.disposed?.surface], ['open', 5, { connected: true, width: 160, height: 100 }]);
  check(issues, 'B08', 'ENGINE_RENDER_AFTER_INPUT_DISPOSE', [byId.B08.afterRender?.renderCount, byId.B08.afterRender?.lastFrameId], [3, 3]);
  check(issues, 'B08', 'CLOSED_NATIVE_INERT', byId.B08.afterProbe, byId.B08.afterRender);
  for (const [index, kind] of ['down', 'up'].entries()) nativeInput(byId.B08.probes?.[index], [50, 40], kind, 'B08', issues);
  pairIssues(byId.B08.ledger, 1, true, issues, 'B08', 'PHYSICAL_REMOVAL');
  check(issues, 'B09', 'CSS_SECOND_ADAPTER', [byId.B09.snapshot?.generation, byId.B09.snapshot?.state, byId.B09.snapshot?.scopeState, byId.B09.snapshot?.renderCount], [2, 'idle', 'open', 4]);
  pairIssues(byId.B09.ledger, 2, false, issues, 'B09', 'CSS_SECOND_PAIRS');
  const css = byId.B10.down?.snapshot;
  nativeInput(byId.B10.down?.input, [50, 40], 'down', 'B10', issues); nativeInput(byId.B10.up?.input, [50, 40], 'up', 'B10', issues);
  check(issues, 'B10', 'CSS_REFUSAL', [css?.state, css?.log, css?.diagnostics], ['closed', [], [{ code: 'MOUSE_INPUT_CALLBACK_FAILED', phase: 'engine', severity: 'error', causeCode: 'MOUSE_INPUT_CALLBACK_FAILED', nestedCauseCode: 'MOUSE_INPUT_SURFACE_INVALID' }]]);
  check(issues, 'B10', 'CSS_LAYOUT_WITNESS', byId.B10.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  check(issues, 'B10', 'CSS_UP_INERT', byId.B10.up?.snapshot, css);
  pairIssues(byId.B10.ledger, 2, true, issues, 'B10', 'CSS_PHYSICAL_REMOVAL');
  const closed = byId.B11.snapshot;
  for (const [key, expected] of Object.entries({ phase: 'closed', state: 'closed', scopeState: 'closed', liveNodes: 0, disposedNodes: 5, pendingHostTimers: 0 })) check(issues, 'B11', 'CLOSED_' + key, closed?.[key], expected);
  check(issues, 'B11', 'HOST_RETIREMENT', closed?.hostTrace, ['host.start', 'host.stop', 'host.close']);
  check(issues, 'B11', 'ENGINE_CLOSED_NATIVE_INERT', byId.B11.afterProbe, closed);
  for (const [index, kind] of ['down', 'up'].entries()) nativeInput(byId.B11.probes?.[index], [50, 40], kind, 'B11', issues);
  const expectedPixels = { B01: INITIAL_RGBA, B02: INITIAL_RGBA, B03: INITIAL_RGBA, B04: INITIAL_RGBA, B05: INITIAL_RGBA, B06: INITIAL_RGBA, B07: COVER_RGBA, B08: COVER_RGBA, B09: INITIAL_RGBA, B10: INITIAL_RGBA, B11: INITIAL_RGBA };
  for (const row of rows) check(issues, row.id, 'LITERAL_RGBA', row.samples?.map(sample => sample.rgba), expectedPixels[row.id]);
  return { complete: true, setupComplete: setupIssues.length === 0, issues };
}

export function classifyContext(context) {
  const observations = inspectRows(context?.rows);
  if (!observations.complete || !observations.setupComplete || !same(context?.errors, []) || context?.overflow !== false || !same(context?.cleanup, { applicationClosed: true, pageClosed: true, contextClosed: true, observerRestored: true, pendingActors: 0 })) return { status: 'INCOMPLETE', issues: observations.issues };
  if (context.id === 'baseline') return { status: observations.issues.length ? 'FAIL_NATIVE_BASELINE' : 'PASS_NATIVE_BASELINE', issues: observations.issues };
  const rule = CONTROLS.find(row => row.id === context.id);
  if (!rule) return { status: 'INCOMPLETE', issues: [{ code: 'CONTROL_UNKNOWN' }] };
  return { status: observations.issues.some(issue => issue.code === rule.witness) ? 'PASS_ASSIGNED_CONTROL_SENSITIVITY' : 'FAIL_ASSIGNED_CONTROL_SENSITIVITY', witness: rule.witness, issues: observations.issues };
}

/** Bind receipts to saved raw RGBA/rows/PNG bytes before interpreting sensitivity. */
export async function admitCollection(report, readArtifact) {
  const issues = [];
  if (!same(report?.contexts?.map(context => context.id), CONTEXT_IDS)) issues.push({ code: 'CONTEXT_INVENTORY' });
  if (!same(report?.environment?.viewport, { width: 900, height: 700 }) || report?.environment?.deviceScaleFactor !== 2 || report?.environment?.channel !== 'msedge' || report?.environment?.headless !== true || !same(report?.environment?.extraLaunchFlags, [])) issues.push({ code: 'ENVIRONMENT' });
  if (!Array.isArray(report?.inputs?.before) || report.inputs.before.length === 0 || !same(report.inputs.before, report.inputs.after)) issues.push({ code: 'INPUT_IDENTITY_CHANGED' });
  const ids = new Set(), artifacts = new Set();
  for (const context of report?.contexts ?? []) {
    if (!context.contextId || ids.has(context.contextId)) issues.push({ code: 'CONTEXT_REUSED' }); ids.add(context.contextId);
    const restoration = context.observerRestoration;
    if (restoration?.restored !== true || restoration?.nativeRestored !== true || restoration?.signalRestored !== true || !same(restoration?.errors, []) || !Number.isInteger(context.requests) || context.requests < 1 || context.requests > 192) issues.push({ code: 'OBSERVER_OR_REQUEST_EVIDENCE', context: context.id });
    if (context.id !== 'OMIT_PHYSICAL_REMOVE' && !same(restoration?.recovery, { nativeAttempts: 0, nativeSucceeded: 0, abortAttempts: 0, abortSucceeded: 0 })) issues.push({ code: 'PRODUCT_REMOVAL_REQUIRED_RECOVERY', context: context.id });
    if (!Array.isArray(context.advisories) || context.advisories.some(item => !same(item, { bucket: 'advisories', kind: 'CANVAS_READBACK_ADVISORY', message: readbackWarning }))) issues.push({ code: 'CONSOLE_CLASSIFICATION', context: context.id });
    if (!same(context.artifacts?.map(item => item.kind), ['before', 'after', 'rows', 'rgba'])) { issues.push({ code: 'ARTIFACT_INVENTORY', context: context.id }); continue; }
    const bodies = new Map();
    for (const artifact of context.artifacts) {
      if (typeof artifact.path !== 'string' || !artifact.path.startsWith(context.id + '.') || /[\\/]|\.\./.test(artifact.path) || artifacts.has(artifact.path) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1 || artifact.bytes > 16777216 || !/^[a-f0-9]{64}$/.test(artifact.sha256)) { issues.push({ code: 'ARTIFACT_IDENTITY' }); continue; }
      artifacts.add(artifact.path);
      try {
        const bytes = await readArtifact(artifact.path);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== artifact.bytes || hash(bytes) !== artifact.sha256) throw new Error('Artifact byte identity differs');
        bodies.set(artifact.kind, bytes);
        if (artifact.kind === 'rows' && !same(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), context.rows)) throw new Error('Saved rows differ');
        if (['before', 'after'].includes(artifact.kind)) {
          if (bytes.length < 24 || !same(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])) throw new Error('PNG signature absent');
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          if (view.getUint32(16) !== 1800 || view.getUint32(20) !== 1400) throw new Error('PNG declared viewport/DPR dimensions differ');
        }
      } catch (cause) { issues.push({ code: 'ARTIFACT_UNAVAILABLE', context: context.id, cause: String(cause) }); }
    }
    const raw = bodies.get('rgba'); let offset = 0;
    for (const row of context.rows ?? []) {
      const expectedBytes = row.samples?.flatMap(sample => sample.rgba) ?? [];
      if (!same(row.samples?.map(sample => sample.point), POINTS) || !same(row.raw, { artifact: context.id + '.rgba', offset, length: 12 }) || !raw || !same(Array.from(raw.subarray(offset, offset + 12)), expectedBytes)) issues.push({ code: 'RAW_RGBA_BINDING', context: context.id, row: row.id });
      offset += 12;
    }
    if (!raw || raw.length !== offset) issues.push({ code: 'RAW_RGBA_LENGTH', context: context.id });
    if (context.id !== 'baseline') {
      const rule = CONTROLS.find(row => row.id === context.id), projection = context.projection;
      if (!rule || projection?.id !== rule.id || projection?.sourcePath !== rule.source || projection?.emittedPath !== rule.emitted || projection?.logicReplacements !== 1 || projection?.servedCopyRestored !== true || ['source', 'emitted', 'served'].some(role => projection?.[role]?.originalSHA256 !== projection?.[role]?.restoredSHA256 || !/^[a-f0-9]{64}$/.test(projection?.[role]?.projectedSHA256 ?? '') || projection?.[role]?.projectedSHA256 === projection?.[role]?.originalSHA256)) issues.push({ code: 'CONTROL_PROJECTION_IDENTITY', context: context.id });
    }
  }
  if (!same(report?.retirement, { browserClosed: true, serverClosed: true, pendingActors: 0 }) || report?.runnerFailure || !same(report?.retirementFailures, [])) issues.push({ code: 'RUNNER_INCOMPLETE' });
  if (issues.length) return { status: 'INCOMPLETE', nativeInputAccepted: false, issues };
  const results = report.contexts.map(classifyContext);
  if (results.some(result => result.status === 'INCOMPLETE')) return { status: 'INCOMPLETE', nativeInputAccepted: false, results };
  if (results[0].status !== 'PASS_NATIVE_BASELINE') return { status: 'FAIL_NATIVE_BASELINE', nativeInputAccepted: false, results };
  if (results.slice(1).some(result => result.status !== 'PASS_ASSIGNED_CONTROL_SENSITIVITY')) return { status: 'FAIL_CONTROL_SENSITIVITY', nativeInputAccepted: false, results };
  return { status: 'PASS_DESKTOP_PRIMARY_MOUSE_CANVAS_SUBSET', nativeInputAccepted: true, results, scope: 'Two bounded desktop mouse adapter generations; literal events, coordinates, pixels and observed physical listener cleanup. No mobile, full UI, OS reclamation or performance acceptance.' };
}
