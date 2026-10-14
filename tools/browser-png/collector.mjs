// SPDX-License-Identifier: Apache-2.0
// No actor starts until all original source, actual reviews and the full graph agree.
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { fingerprintFile, logicalPath, ownerRelativePath, samePhysicalPath, canonicalTextBytes } from '../lib/file-identity.mjs';
import { freezeBrowserPngGraph } from './file-graph.mjs';
import { inspectBrowserPngCapture, inspectWrongOracle } from './oracle.mjs';

const hash = body => createHash('sha256').update(body).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DATA_BYTES = 67_108_864, RUNTIME_FILE_BYTES = 268_435_456, RUNTIME_TOTAL_BYTES = 1_073_741_824;
const SOURCE_ROLES = ['plan', 'productSource', 'observerSource', 'collectorSource'];
const ACTUAL_ROLES = ['missingEntryRed', 'cpu', 'build', 'strictTypes', 'policy', 'observerUnits', 'fixtures'];
const COLLECTOR_PATHS = ['tools/verify-browser-png.mjs', 'tools/browser-png/collector.mjs',
  'tools/browser-png/fixture.mjs', 'tools/browser-png/file-graph.mjs', 'tools/browser-png/oracle.mjs'];
const PRODUCT_PATHS = ['packages/engine/web/image.ts', 'packages/engine/web/BrowserTextureProvider.ts', 'packages/engine/package.json',
  'packages/engine/dist/web/image.js', 'packages/engine/dist/web/image.d.ts',
  'packages/engine/dist/web/BrowserTextureProvider.js', 'packages/engine/dist/web/BrowserTextureProvider.d.ts'];
function requireData(condition, message, code = 'BIP_NATIVE_ADMISSION') {
  if (!condition) throw Object.assign(new Error(message), { code });
}
function occurrence(cause) {
  return { occurrence: true, undefined: cause === undefined, name: typeof cause?.name === 'string' ? cause.name : null,
    code: typeof cause?.code === 'string' ? cause.code : null, message: typeof cause?.message === 'string' ? cause.message : String(cause) };
}
function original(pin, maximumBytes = DATA_BYTES) {
  requireData(pin && path.isAbsolute(pin.path) && Number.isSafeInteger(pin.bytes) && pin.bytes >= 0
    && pin.bytes <= maximumBytes && /^[a-f0-9]{64}$/.test(pin.sha256), 'Exact original absolute pin required');
  const owner = path.dirname(pin.path), relative = ownerRelativePath(owner, pin.path), current = fingerprintFile(owner, relative);
  requireData(current.bytes === pin.bytes && current.sha256 === pin.sha256, 'Original pin drift: ' + pin.path);
  const bytes = readFileSync(pin.path);
  requireData(bytes.length === pin.bytes && hash(bytes) === pin.sha256, 'Returned original bytes drift: ' + pin.path);
  return bytes;
}
function pointer(value, key) {
  requireData(typeof key === 'string' && key.startsWith('/') && key.length <= 512, 'Explicit original JSON pointer required');
  for (const part of key.slice(1).split('/')) {
    requireData(/^[A-Za-z0-9_-]+$/.test(part) && part !== '__proto__' && value !== null
      && typeof value === 'object' && Object.hasOwn(value, part), 'Missing original pointer: ' + key);
    value = value[part];
  }
  return value;
}
function containedOutput(owner, output, repositoryRoot) {
  requireData(path.isAbsolute(owner) && path.isAbsolute(output) && lstatSync(owner).isDirectory()
    && !lstatSync(owner).isSymbolicLink() && samePhysicalPath(owner, realpathSync(owner)), 'Canonical output owner required');
  const relative = ownerRelativePath(owner, output);
  requireData(relative.split('/').length === 1 && !existsSync(output), 'Fresh direct output child required');
  let inside = false; try { ownerRelativePath(repositoryRoot, output); inside = true; } catch { /* outside the checkout is required */ }
  requireData(!inside && !samePhysicalPath(output, repositoryRoot), 'Output must leave the source checkout');
}

/** Validate one explicit producer schema, not basename discovery or a current-hash stand-in. */
export function admitBrowserPngCollection(admissionPin, output, profile = 'browser-png') {
  const admission = JSON.parse(original(admissionPin));
  if (profile === 'nine-slice-bitmap') return admitNineSliceBitmap(admission, output);
  if (profile === 'display-container-remove-children') return admitNineSliceBitmap(admission, output, true);
  if (profile === 'display-container-child-index') return admitNineSliceBitmap(admission, output, false, true);
  requireData(profile === 'browser-png', 'Explicit collector profile required');
  requireData(admission.schemaVersion === 1 && admission.status === 'BIP1_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED', 'Native source/actual admission missing');
  requireData(samePhysicalPath(admission.sourceFilesRoot, admission.graphInputs.repositoryRoot), 'Graph has another source owner');
  const root = admission.sourceFilesRoot;
  const expectedCollectors = [
    { path: 'tools/browser-png/fixture.mjs', role: 'fixture', route: '/fixture.mjs' },
    { path: 'tools/browser-png/native-observer.mjs', role: 'native-observer', route: '/native-observer.mjs' },
    ...['tools/verify-browser-png.mjs','tools/browser-png/collector.mjs','tools/browser-png/file-graph.mjs',
      'tools/browser-png/oracle.mjs','tests/browser-png-native-observer.test.mjs'].map(path => ({ path, role: 'host-only' })),
  ];
  requireData(equal(admission.graphInputs.collectorFiles, expectedCollectors), 'Exact collector/observer source inventory required');
  const reviews = new Map();
  requireData(Array.isArray(admission.reviewPins) && admission.reviewPins.length === SOURCE_ROLES.length + ACTUAL_ROLES.length, 'Complete exact review role list required');
  for (const row of admission.reviewPins) {
    requireData([...SOURCE_ROLES, ...ACTUAL_ROLES].includes(row.role) && !reviews.has(row.role), 'Duplicate/unlisted review role');
    const data = JSON.parse(original(row.pin));
    requireData(data.openFindings === 0 && typeof data.verdict === 'string'
      && (SOURCE_ROLES.includes(row.role) ? data.verdict.startsWith('PASS_SOURCE') : data.verdict.startsWith('PASS_ACTUAL')),
    'Pending or unaccepted role: ' + row.role);
    reviews.set(row.role, { pin: row.pin, data });
  }
  const graph = freezeBrowserPngGraph(admission.graphInputs);
  const savedGraph = JSON.parse(original(admission.graphPin));
  requireData(equal(graph, savedGraph), 'Complete originally admitted graph differs');
  const buildReview = reviews.get('build').data;
  requireData(buildReview.actualResults?.stockBuild?.exitCode === 0
    && samePhysicalPath(buildReview.currentFileRoot, root)
    && Array.isArray(buildReview.currentEmissionReadbackPins) && buildReview.currentEmissionReadbackPins.length === 4,
  'Original CPU review stock-build/emission qualification required');
  for (const row of buildReview.currentEmissionReadbackPins) {
    const current = graph.filePins.find(pin => pin.owner === 'repository' && pin.path === row.path);
    requireData(PRODUCT_PATHS.slice(3).includes(row.path) && current
      && current.bytes === row.bytes && current.sha256 === row.sha256, 'Original build emission drift');
  }
  requireData(Array.isArray(admission.proofBindings) && admission.proofBindings.length > 0 && admission.proofBindings.length <= 4096, 'Explicit accepted-review source bindings required');
  const coverage = new Map();
  for (const row of admission.proofBindings) {
    requireData(reviews.has(row.role), 'Binding has another review role');
    const review = reviews.get(row.role).data, accepted = pointer(review, row.pinPointer);
    requireData(accepted && typeof accepted.path === 'string' && Number.isSafeInteger(accepted.bytes)
      && /^[a-f0-9]{64}$/.test(accepted.sha256), 'Accepted pointer is not an original pin');
    let acceptedFile = accepted.path;
    if (!path.isAbsolute(acceptedFile)) {
      logicalPath(acceptedFile);
      let owner;
      if (row.ownerManifestPointer !== undefined) {
        requireData(SOURCE_ROLES.includes(row.role), 'Only source reviews may bind an original candidate owner');
        const manifestPin = pointer(review, row.ownerManifestPointer);
        const manifest = JSON.parse(original(manifestPin));
        requireData(Array.isArray(manifest.authoredPins) && manifest.authoredPins.some(pin => pin.path === accepted.path
          && pin.bytes === accepted.bytes && pin.sha256 === accepted.sha256), 'Original candidate does not own the reviewed row');
        owner = manifest.candidateRoot;
      } else owner = pointer(review, row.ownerPointer);
      requireData(typeof owner === 'string' && path.isAbsolute(owner), 'Accepted row requires its exact original source owner');
      acceptedFile = path.join(owner, ...acceptedFile.split('/'));
    }
    const target = graph.filePins.find(item => item.owner === row.graphOwner && item.path === row.graphPath);
    requireData(target && accepted.bytes === target.bytes && accepted.sha256 === target.sha256, 'Accepted review does not bind current graph bytes');
    const graphFile = target.owner === 'repository' ? path.join(root, ...target.path.split('/')) : target.path;
    // A candidate owner may differ from the adopted owner; equality of its full,
    // original raw bytes is checked, never an abbreviated filename.
    original({ path: acceptedFile, bytes: accepted.bytes, sha256: accepted.sha256 });
    original({ path: graphFile, bytes: target.bytes, sha256: target.sha256 });
    if (!coverage.has(row.role)) coverage.set(row.role, new Set());
    coverage.get(row.role).add(target.path);
  }
  const covered = (roles, key) => roles.some(role => coverage.get(role)?.has(key));
  for (const key of PRODUCT_PATHS) requireData(covered(['productSource', 'cpu', 'build', 'strictTypes', 'policy'], key), 'Current product source/emission lacks accepted original binding: ' + key);
  for (const key of PRODUCT_PATHS.slice(3)) requireData(covered(['build'], key), 'Build role lacks exact original emission pointer: ' + key);
  for (const key of COLLECTOR_PATHS) requireData(covered(['collectorSource'], key), 'Collector source lacks independent review binding: ' + key);
  for (const key of ['tools/browser-png/native-observer.mjs', 'tests/browser-png-native-observer.test.mjs']) {
    requireData(covered(['observerSource'], key) && covered(['observerUnits'], key), 'Original observer source/units missing: ' + key);
  }
  requireData(covered(['plan'], graph.schedulePin.path), 'Literal schedule lacks independent source binding');
  for (const fixture of graph.fixturePins) requireData(covered(['fixtures'], fixture.path), 'Encoded original lacks actual generation binding');
  requireData(Array.isArray(admission.runtime.pins) && admission.runtime.pins.length > 0 && admission.runtime.pins.length <= 4096, 'Installed runtime inventory required');
  // Executables have a separate raw-byte budget; JSON/data limits do not model them.
  let runtimeBytes = 0;
  for (const pin of admission.runtime.pins) {
    requireData(Number.isSafeInteger(pin.bytes) && pin.bytes >= 0 && pin.bytes <= RUNTIME_FILE_BYTES, 'Installed runtime file budget');
    runtimeBytes += pin.bytes;
    requireData(runtimeBytes <= RUNTIME_TOTAL_BYTES, 'Installed runtime aggregate budget');
  }
  for (const pin of admission.runtime.pins) original(pin, RUNTIME_FILE_BYTES);
  requireData(samePhysicalPath(process.execPath, admission.runtime.nodeExecutable.path), 'Actor is not admitted Node');
  original(admission.runtime.nodeExecutable, RUNTIME_FILE_BYTES); original(admission.runtime.playwrightEntry);
  original(admission.runtime.edgeExecutable, RUNTIME_FILE_BYTES);
  requireData(admission.runtime.pins.some(pin => equal(pin, admission.runtime.nodeExecutable))
    && admission.runtime.pins.some(pin => equal(pin, admission.runtime.playwrightEntry))
    && admission.runtime.pins.some(pin => equal(pin, admission.runtime.edgeExecutable)), 'Node/Playwright/installed Edge owners missing from inventory');
  containedOutput(admission.outputOwner, output, root);
  return { admission, graph, reviews: [...reviews].map(([role, row]) => ({ role, pin: row.pin, verdict: row.data.verdict })) };
}

// One finite additional scene shares the existing pin reader, graph and lifecycle.
// It consumes original reviewed Source/build facts; it never qualifies its own review.
function admitNineSliceBitmap(admission, output, removeChildren = false, childIndex = false) {
  const sourceRoles=['plan','productSource','collectorSource'], actualRoles=['missingEntryRed','cpu','build','strictTypes','policy'];
  // The new opt-in scene reuses the original eight-role raw binding checks.
  const profile=childIndex?'display-container-child-index':removeChildren?'display-container-remove-children':'nine-slice-bitmap';
  const leafDirectory=childIndex?'display-container-child-index-native':removeChildren?'display-container-remove-children-native':'nine-slice-bitmap-native';
  const sourcePaths=removeChildren||childIndex?['packages/runtime/src/DisplayObjectContainer.ts','packages/runtime/src/displayTreeState.ts']
    :['packages/runtime/src/NineSliceBitmap.ts','packages/runtime/src/Mesh2D.ts',
    'packages/runtime/src/meshDisplayState.ts','packages/runtime/src/index.ts','packages/engine/src/index.ts','packages/runtime/src/Texture.ts'];
  const emittedPaths=sourcePaths.flatMap(key=>[key.replace('/src/','/dist/').replace(/\.ts$/,'.js'),key.replace('/src/','/dist/').replace(/\.ts$/,'.d.ts')]);
  const collectorPaths=['tools/verify-browser-png.mjs','tools/browser-png/collector.mjs','tools/browser-png/file-graph.mjs',
    'tools/'+leafDirectory+'/fixture.mjs','tools/'+leafDirectory+'/oracle.mjs'];
  const status=childIndex?'DISPLAY_CONTAINER_CHILD_INDEX_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED':removeChildren?'DISPLAY_CONTAINER_REMOVE_CHILDREN_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED':'NINE_SLICE_BITMAP_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED';
  requireData(admission.schemaVersion===1&&admission.status===status
    &&admission.graphInputs?.profile===profile&&samePhysicalPath(admission.sourceFilesRoot,admission.graphInputs.repositoryRoot),'Exact bounded scene source/actual admission');
  const root=admission.sourceFilesRoot,expectedCollectors=[{path:'tools/'+leafDirectory+'/fixture.mjs',role:'fixture',route:'/fixture.mjs'},
    ...collectorPaths.filter(key=>key!=='tools/'+leafDirectory+'/fixture.mjs').map(path=>({path,role:'host-only'}))];
  requireData(equal(admission.graphInputs.collectorFiles,expectedCollectors),'Exact NineSlice collector Source inventory');
  const reviews=new Map();requireData(Array.isArray(admission.reviewPins)&&admission.reviewPins.length===sourceRoles.length+actualRoles.length,'Exact NineSlice review roles');
  for(const row of admission.reviewPins){
    requireData([...sourceRoles,...actualRoles].includes(row.role)&&!reviews.has(row.role),'Unique NineSlice review role');
    const data=JSON.parse(original(row.pin));requireData(data.openFindings===0&&typeof data.verdict==='string'
      &&data.verdict.startsWith(sourceRoles.includes(row.role)?'PASS_SOURCE':'PASS_ACTUAL'),'Accepted original NineSlice review: '+row.role);
    if(actualRoles.includes(row.role))requireData(samePhysicalPath(data.currentFileRoot,root),'Current NineSlice actual review owner');
    reviews.set(row.role,{pin:row.pin,data});
  }
  const graph=freezeBrowserPngGraph(admission.graphInputs);requireData(equal(graph,JSON.parse(original(admission.graphPin))),'Exact originally admitted NineSlice graph');
  requireData(Array.isArray(admission.proofBindings)&&admission.proofBindings.length>0&&admission.proofBindings.length<=4096,'Explicit original NineSlice Source/build bindings');
  const coverage=new Map();
  for(const row of admission.proofBindings){
    requireData(reviews.has(row.role),'Binding belongs to an admitted NineSlice review');
    const review=reviews.get(row.role).data,accepted=pointer(review,row.pinPointer);
    requireData(accepted&&typeof accepted.path==='string'&&Number.isSafeInteger(accepted.bytes)&&/^[a-f0-9]{64}$/.test(accepted.sha256),'Original NineSlice review pin pointer');
    let acceptedFile=accepted.path;
    if(!path.isAbsolute(acceptedFile)){
      logicalPath(acceptedFile);let owner;
      if(row.ownerManifestPointer!==undefined){
        requireData(sourceRoles.includes(row.role),'Only Source roles use original candidate manifests');
        const manifest=JSON.parse(original(pointer(review,row.ownerManifestPointer)));
        requireData(Array.isArray(manifest.authoredPins)&&manifest.authoredPins.some(pin=>equal(pin,accepted)),'Original candidate owns exact reviewed NineSlice row');owner=manifest.candidateRoot;
      }else owner=pointer(review,row.ownerPointer);
      requireData(typeof owner==='string'&&path.isAbsolute(owner),'Full original NineSlice reviewed owner');acceptedFile=path.join(owner,...acceptedFile.split('/'));
    }
    const target=graph.filePins.find(pin=>pin.owner===row.graphOwner&&pin.path===row.graphPath);
    requireData(target&&target.bytes===accepted.bytes&&target.sha256===accepted.sha256,'Current NineSlice graph binding drift');
    original({path:acceptedFile,bytes:accepted.bytes,sha256:accepted.sha256});
    original({path:target.owner==='repository'?path.join(root,...target.path.split('/')):target.path,bytes:target.bytes,sha256:target.sha256});
    if(!coverage.has(row.role))coverage.set(row.role,new Set());coverage.get(row.role).add(target.path);
  }
  for(const key of sourcePaths)requireData(coverage.get('productSource')?.has(key)&&coverage.get('cpu')?.has(key),'Current independently reviewed Source/CPU binding: '+key);
  for(const key of emittedPaths)requireData(coverage.get('build')?.has(key),'Actual built NineSlice emission binding: '+key);
  for(const key of collectorPaths)requireData(coverage.get('collectorSource')?.has(key),'Independent NineSlice collector Source binding: '+key);
  requireData(coverage.get('plan')?.has(graph.schedulePin.path),'Original independently reviewed NineSlice schedule binding');
  requireData(Array.isArray(admission.runtime?.pins)&&admission.runtime.pins.length>0&&admission.runtime.pins.length<=4096,'Installed native runtime inventory');
  let bytes=0;for(const pin of admission.runtime.pins){bytes+=pin.bytes;requireData(bytes<=RUNTIME_TOTAL_BYTES,'Native runtime aggregate bound');original(pin,RUNTIME_FILE_BYTES);}
  for(const pin of [admission.runtime.nodeExecutable,admission.runtime.playwrightEntry,admission.runtime.edgeExecutable]){
    requireData(admission.runtime.pins.some(row=>equal(row,pin)),'Explicit Node/Playwright/installed Edge pin');original(pin,RUNTIME_FILE_BYTES);}
  requireData(samePhysicalPath(process.execPath,admission.runtime.nodeExecutable.path),'Actual admitted Node');containedOutput(admission.outputOwner,output,root);
  return {admission,graph,reviews:[...reviews].map(([role,row])=>({role,pin:row.pin,verdict:row.data.verdict}))};
}

export async function collectBrowserPng({ admissionPin, output, profile = 'browser-png' }) {
  const nineSlice = profile === 'nine-slice-bitmap';
  const removeChildren = profile === 'display-container-remove-children', childIndex = profile === 'display-container-child-index';
  const literalScene = nineSlice || removeChildren || childIndex;
  const qualified = admitBrowserPngCollection(admissionPin, output, profile);
  const { admission, graph } = qualified;
  const leafOracle = childIndex ? await import('../display-container-child-index-native/oracle.mjs')
    : removeChildren ? await import('../display-container-remove-children-native/oracle.mjs')
    : nineSlice ? await import('../nine-slice-bitmap-native/oracle.mjs') : null;
  const scheduleBytes = Buffer.from(graph.schedulePin.bodyBase64, 'base64'), schedule = JSON.parse(scheduleBytes);
  requireData(childIndex ? equal(schedule.backends,['canvas','webgpu']) && schedule.profile===profile && schedule.frame.pixelTolerance===0
    && schedule.frame.width===24 && schedule.frame.height===24 && schedule.plannedTotals.renderSubmissions===6
    && schedule.plannedTotals.newCaptures===4 && schedule.plannedTotals.savedReplays===2
    && equal(schedule.stepsPerBackend,[{id:'N1',scene:'before'},{id:'N2',scene:'after-query-reorder'},{id:'N3',replay:'N1',sameEngineAlive:true}])
    : removeChildren ? equal(schedule.backends,['canvas','webgpu']) && schedule.profile===profile && schedule.frame.pixelTolerance===0
    && schedule.frame.width===24 && schedule.frame.height===24 && schedule.plannedTotals.renderSubmissions===6
    && schedule.plannedTotals.newCaptures===4 && schedule.plannedTotals.savedReplays===2
    && equal(schedule.stepsPerBackend,[{id:'N1',scene:'before'},{id:'N2',scene:'after-remove-children'},{id:'N3',replay:'N1',sameEngineAlive:true}])
    : nineSlice ? equal(schedule.backends,['webgpu']) && schedule.profile===profile && schedule.frame.pixelTolerance===0
    && schedule.frame.width===24 && schedule.frame.height===24 && schedule.plannedTotals.renderSubmissions===3
    && schedule.plannedTotals.newCaptures===2 && schedule.plannedTotals.savedReplays===1
    && equal(schedule.stepsPerBackend,[{id:'N1',target:[16,12]},{id:'N2',target:[12,16]},{id:'N3',replay:'N1',afterOriginRetirement:true}])
    : equal(schedule.backends, ['canvas', 'webgpu']) && schedule.frame.pixelTolerance === 0
    && schedule.plannedTotals.renderSubmissions === 6 && schedule.plannedTotals.newCaptures === 4
    && schedule.plannedTotals.savedReplays === 2, 'Original finite schedule required');
  mkdirSync(output); const writeJson = (name, value) => writeFileSync(path.join(output, logicalPath(name)), canonicalTextBytes(JSON.stringify(value, null, 2)), { flag: 'wx' });
  writeJson('admission-input.json', { admissionPin, reviews: qualified.reviews });
  writeJson('module-graph-before.json', graph); writeFileSync(path.join(output, 'original-schedule.json'), scheduleBytes, { flag: 'wx' });
  for (const fixture of graph.fixturePins) writeFileSync(path.join(output, path.basename(fixture.route)), Buffer.from(fixture.bodyBase64, 'base64'), { flag: 'wx' });
  const startedAt = Date.now(), operationDeadline = startedAt + 180_000, cleanupDeadline = startedAt + 220_000;
  const results = [], requests = [], browserEvents = [], cleanupErrors = [], tickets = [], contexts = [];
  let primaryOccurred = false, primary, closing = false, browser, server, browserVersion;
  let browserCloseFulfilled = false, serverCloseFulfilled = false;
  let nineSliceMainEntered = false;
  const removeChildrenEntered = new Set();
  const childIndexEntered = new Set();
  const wrongControls = [];
  const fail = cause => { if (!primaryOccurred) { primaryOccurred = true; primary = cause; } };
  const handled = value => { const promise = Promise.resolve(value); promise.catch(() => undefined); return promise; };
  function track(value, label, register) {
    const promise = handled(value), record = { id: tickets.length + 1, label, settled: false };
    tickets.push(record);
    handled(promise.then(result => { record.settled = true; record.fulfilled = true;
      try { register?.(result); } catch (cause) { fail(cause); }
    }, cause => { record.settled = true; record.fulfilled = false; record.error = occurrence(cause); }));
    return promise;
  }
  async function bounded(value, label, cleanup = false) {
    const promise = handled(value), remaining = Math.min(20_000, (cleanup ? cleanupDeadline : operationDeadline) - Date.now());
    requireData(remaining > 0, label + ' deadline expired', 'BIP_NATIVE_DEADLINE'); let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label + ' pending'), { code: 'BIP_NATIVE_TIMEOUT' })), remaining);
    })]); } finally { clearTimeout(timer); }
  }
  const routes = new Map();
  function route(name, bytes, mime, backend) {
    requireData(!routes.has(name), 'Duplicate sealed route'); routes.set(name, { bytes, mime, backend, sha256: hash(bytes) });
  }
  for (const row of graph.moduleRoutes) route(row.route, Buffer.from(row.bodyBase64, 'base64'), 'text/javascript');
  for (const row of graph.fixturePins) route(row.route, Buffer.from(row.bodyBase64, 'base64'), 'image/png');
  route('/schedule.json', scheduleBytes, 'application/json'); route('/favicon.ico', Buffer.alloc(0), 'image/x-icon');
  const importMapText = JSON.stringify(graph.importMap), importMapHash = createHash('sha256').update(importMapText).digest('base64');
  for (const backend of schedule.backends) {
    const host = backend === 'canvas' ? '@egret/engine/web' : '@egret/engine/webgpu';
    const entry = childIndex ? canonicalTextBytes(`import * as hostEntry from '${host}';\nimport { createDisplayContainerChildIndexFixture } from '/fixture.mjs';\nwindow.__bip = createDisplayContainerChildIndexFixture({backend:'${backend}',hostEntry});\nwindow.__bipReady = true;\n`)
      : removeChildren ? canonicalTextBytes(`import * as hostEntry from '${host}';\nimport { createDisplayContainerRemoveChildrenFixture } from '/fixture.mjs';\nwindow.__bip = createDisplayContainerRemoveChildrenFixture({backend:'${backend}',hostEntry});\nwindow.__bipReady = true;\n`)
      : nineSlice ? canonicalTextBytes("import { createNineSliceBitmapFixture } from '/fixture.mjs';\nwindow.__bip = createNineSliceBitmapFixture();\nwindow.__bipReady = true;\n")
      : canonicalTextBytes(`import * as hostEntry from '${host}';\nimport { createBrowserPngFixture } from '/fixture.mjs';\nconst response = await fetch('/schedule.json', {redirect:'error'});\nif (!response.ok) throw new Error('BIP_SCHEDULE_RESPONSE');\nconst schedule = await response.json();\nwindow.__bip = createBrowserPngFixture({backend:'${backend}',hostEntry,schedule});\nwindow.__bipReady = true;\n`);
    const html = canonicalTextBytes(`<!doctype html><meta charset="utf-8"><link rel="icon" href="/favicon.ico"><style>body{margin:0;background:transparent}</style><script type="importmap">${importMapText}</script><script type="module" src="/entry-${backend}.mjs"></script>\n`);
    route('/entry-' + backend + '.mjs', entry, 'text/javascript', backend); route('/' + backend, html, 'text/html', backend);
    writeFileSync(path.join(output, 'entry-' + backend + '.mjs'), entry, { flag: 'wx' });
    writeFileSync(path.join(output, 'entry-' + backend + '.html'), html, { flag: 'wx' });
  }
  let activeBackend, hostHeader;
  try {
    server = createServer((request, response) => {
      const item = routes.get(request.url);
      const module = graph.moduleRoutes.find(row => row.route === request.url);
      const allowed = request.method === 'GET' && request.headers.host === hostHeader && item
        && (!item.backend || item.backend === activeBackend) && requests.length < 4096
        && (!module || graph.backendClosures.find(row => row.backend === activeBackend)?.moduleRoutes.includes(request.url))
        && !request.headers['content-length'] && !request.headers['transfer-encoding'];
      if (!allowed) { fail(Object.assign(new Error('Unlisted method/Host/route'), { code: 'BIP_NATIVE_REQUEST' })); response.writeHead(400); response.end(); return; }
      requests.push({ backend: activeBackend, method: request.method, host: request.headers.host,
        route: request.url, bytes: item.bytes.length, sha256: item.sha256 });
      response.writeHead(200, { 'Content-Type': item.mime, 'Content-Length': item.bytes.length, 'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'none'; script-src 'self' 'sha256-${importMapHash}'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'` });
      response.end(item.bytes);
    });
    server.on('error', fail);
    await bounded(track(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 'loopback.listen'), 'loopback.listen');
    hostHeader = '127.0.0.1:' + server.address().port;
    const require = createRequire(import.meta.url), { chromium } = require(admission.runtime.playwrightEntry.path);
    await bounded(track(chromium.launch({ channel: 'msedge', headless: true, timeout: 20_000 }), 'browser.launch', value => {
      browser = value;
      if (closing) track(value.close(), 'late.browser.close', () => { browserCloseFulfilled = true; browser = undefined; });
    }), 'default msedge launch');
    browserVersion = browser.version();
    for (const backend of schedule.backends) {
      requireData(!primaryOccurred && !closing, 'Earlier native/route failure'); activeBackend = backend;
      const owner = { backend, context: undefined, page: undefined, closeFulfilled: false, fixtureClose: null };
      contexts.push(owner);
      await bounded(track(browser.newContext({ viewport: { width: 800, height: 650 }, deviceScaleFactor: 1 }), 'context.' + backend, value => {
        owner.context = value;
        if (closing) track(value.close(), 'late.context.close.' + backend, () => { owner.closeFulfilled = true; });
      }), 'fresh context');
      await bounded(track(owner.context.newPage(), 'page.' + backend, value => { owner.page = value; }), 'fresh page');
      owner.page.on('pageerror', error => { browserEvents.push({ backend, kind: 'pageerror', error: occurrence(error) }); fail(error); });
      owner.page.on('console', event => { browserEvents.push({ backend, kind: 'console', type: event.type(), text: event.text() }); if (event.type() === 'error') fail(new Error(event.text())); });
      await bounded(track(owner.page.goto('http://' + hostHeader + '/' + backend, { waitUntil: 'load', timeout: 20_000 }), 'goto.' + backend), 'entry navigation');
      await bounded(track(owner.page.waitForFunction(() => window.__bipReady === true, undefined, { timeout: 20_000 }), 'entry.' + backend), 'entry module');
      const setup = await bounded(track(owner.page.evaluate(deadlines => window.__bip.start(deadlines), { operationDeadline, cleanupDeadline }), 'fixture.start.' + backend), 'native resource setup');
      writeJson(backend + '-native-ledger-start.json', setup);
      requireData(!setup.primaryOccurred && setup.cleanupErrors.length === 0 && (literalScene || setup.observerRestored), 'Native resource setup/refusal', 'BIP_NATIVE_ASSERTION');
      for (const [index, image] of setup.sourceImages.entries()) {
        writeFileSync(path.join(output, backend + '-source-image-' + index + '.rgba'), Buffer.from(image.bytes), { flag: 'wx' });
      }
      const nativeReadbacks = literalScene ? [] : setup.operations.filter(row => row.operation === 'canvas-readback' && row.phase === 'returned');
      for (const [index, row] of nativeReadbacks.entries()) writeFileSync(path.join(output,
        backend + '-native-source-readback-' + index + '.rgba'), Buffer.from(row.readback.bytes), { flag: 'wx' });
      const nativeBlobs = literalScene ? [] : setup.operations.filter(row => row.operation === 'decode' && row.phase === 'returned');
      for (const [index, row] of nativeBlobs.entries()) {
        const originalBytes = Buffer.from(row.blob.bytes);
        requireData(graph.fixturePins.some(item => item.bytes === originalBytes.length && item.sha256 === hash(originalBytes)), 'Actual original Blob bytes differ', 'BIP_NATIVE_ASSERTION');
        writeFileSync(path.join(output, backend + '-native-blob-' + index + '.png'), originalBytes, { flag: 'wx' });
      }
      for (const step of ['N1', 'N2', 'N3']) {
        if (nineSlice) nineSliceMainEntered = true;
        if (removeChildren) removeChildrenEntered.add(backend);
        if (childIndex) childIndexEntered.add(backend);
        const packet = await bounded(track(owner.page.evaluate(name => window.__bip.collectStep(name), step), backend + '.' + step), 'original ' + backend + '/' + step);
        // Save complete original bytes before comparison; no fitting of expectations.
        writeJson(backend + '-' + step + '.json', packet);
        requireData(Array.isArray(packet.raw) && packet.raw.length === (literalScene ? 2304 : 128)
          && packet.raw.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255), 'Original readback byte envelope', 'BIP_NATIVE_ASSERTION');
        writeFileSync(path.join(output, backend + '-' + step + '.rgba'), Buffer.from(packet.raw), { flag: 'wx' });
        const comparison = childIndex ? leafOracle.inspectDisplayContainerChildIndexCapture(packet)
          : removeChildren ? leafOracle.inspectDisplayContainerRemoveChildrenCapture(packet)
          : nineSlice ? leafOracle.inspectNineSliceBitmapCapture(packet) : inspectBrowserPngCapture(packet, schedule); writeJson(backend + '-' + step + '-comparison.json', comparison);
        results.push({ backend, step, packet, comparison });
        requireData(comparison.pass, 'Original literal comparison failed', 'BIP_NATIVE_ASSERTION');
      }
      if (!literalScene) {
        const wrong = inspectWrongOracle(results.find(row => row.backend === backend && row.step === 'N2').packet, schedule);
        writeJson(backend + '-wrong-oracle.json', wrong); requireData(wrong.pass, 'Wrong-oracle classification failed', 'BIP_NATIVE_ASSERTION');
        wrongControls.push({ backend, pass: wrong.pass, additionalSubmissions: 0, additionalReadbacks: 0 });
      }
      owner.fixtureClose = await bounded(track(owner.page.evaluate(() => window.__bip.close()), 'fixture.close.' + backend), 'caller fixture retirement', true);
      writeJson(backend + '-retirement.json', owner.fixtureClose);
      requireData(!owner.fixtureClose.primaryOccurred && owner.fixtureClose.cleanupErrors.length === 0
        && owner.fixtureClose.pendingTickets === 0 && owner.fixtureClose.ports.every(row => row.close === 'fulfilled' && row.safeHostReturn), 'Incomplete caller/native retirement', 'BIP_NATIVE_CLOSE_UNSAFE');
      if (nineSlice) requireData(owner.fixtureClose.ports.length===2&&owner.fixtureClose.ports.every(row=>row.deviceDestroyed&&row.deviceLoss?.reason==='destroyed')
        &&owner.fixtureClose.textureRetired&&owner.fixtureClose.scopeState==='closed'&&owner.fixtureClose.leafDisposed&&owner.fixtureClose.borrowedLeaseDropped
        &&owner.fixtureClose.loads===1&&owner.fixtureClose.disposals===1&&owner.fixtureClose.diagnostics.length===0
        &&owner.fixtureClose.canvasRefusal?.status==='PASS_REFUSAL_ONLY'&&owner.fixtureClose.canvasRefusal.positiveCanvasSubmissions===0,'Genuine NineSlice retirement/Canvas refusal','BIP_NATIVE_CLOSE_UNSAFE');
      if (removeChildren) requireData(owner.fixtureClose.ports.length===1 && owner.fixtureClose.scopeState==='closed'
        &&owner.fixtureClose.allSceneNodesDisposed && owner.fixtureClose.diagnostics.length===0
        &&(backend==='canvas'||owner.fixtureClose.ports[0].deviceDestroyed&&owner.fixtureClose.ports[0].deviceLoss?.reason==='destroyed'),
      'Genuine Container scene and native retirement','BIP_NATIVE_CLOSE_UNSAFE');
      if (childIndex) requireData(owner.fixtureClose.ports.length===1 && owner.fixtureClose.scopeState==='closed'
        &&owner.fixtureClose.allSceneNodesDisposed&&owner.fixtureClose.diagnostics.length===0
        &&owner.fixtureClose.loads===1&&owner.fixtureClose.disposals===1&&owner.fixtureClose.textureDisposed
        &&owner.fixtureClose.leaseState?.released===true&&owner.fixtureClose.eventCalls===3
        &&(backend==='canvas'||owner.fixtureClose.ports[0].deviceDestroyed&&owner.fixtureClose.ports[0].deviceLoss?.reason==='destroyed'),
      'Genuine child-index scene/resource/event and native retirement','BIP_NATIVE_CLOSE_UNSAFE');
      await bounded(track(owner.context.close(), 'context.close.' + backend), 'context close', true); owner.closeFulfilled = true;
      for (const entry of graph.entryAliases.filter(row => row.backend === backend)) requireData(requests.some(row => row.backend === backend && row.route === entry.route), 'Required public root was not requested', 'BIP_NATIVE_ASSERTION');
    }
  } catch (cause) { fail(cause); }
  finally {
    closing = true;
    for (const owner of [...contexts].reverse()) {
      if (owner.page && !owner.closeFulfilled && !owner.page.isClosed()) try {
        owner.fixtureClose = await bounded(track(owner.page.evaluate(() => window.__bip?.close()), 'failure.fixture.close.' + owner.backend), 'failure fixture close', true);
        writeJson(owner.backend + '-failure-retirement.json', owner.fixtureClose ?? { fixtureWasNotCreated: true });
        if (!owner.fixtureClose || owner.fixtureClose.pendingTickets || owner.fixtureClose.cleanupErrors?.length) throw Object.assign(new Error('Failure fixture quarantine'), { code: 'BIP_NATIVE_CLOSE_UNSAFE' });
      } catch (cause) { cleanupErrors.push(cause); }
      if (owner.context && !owner.closeFulfilled) try { await bounded(track(owner.context.close(), 'failure.context.close.' + owner.backend), 'failure context close', true); owner.closeFulfilled = true; }
      catch (cause) { cleanupErrors.push(cause); }
    }
    if (browser) try { await bounded(track(browser.close(), 'browser.close'), 'browser close', true); browserCloseFulfilled = true; browser = undefined; }
    catch (cause) { cleanupErrors.push(cause); }
    if (server) try { await bounded(track(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 'loopback.close'), 'loopback close', true); serverCloseFulfilled = true; server = undefined; }
    catch (cause) { cleanupErrors.push(cause); }
  }
  let after, stable = false;
  try { after = freezeBrowserPngGraph(admission.graphInputs); stable = equal(after, graph);
    requireData(stable, 'Source/module/config graph changed'); for (const pin of admission.runtime.pins) original(pin, RUNTIME_FILE_BYTES);
    original(admissionPin); original(admission.graphPin); for (const row of admission.reviewPins) original(row.pin);
    writeJson('module-graph-after.json', after);
  } catch (cause) { cleanupErrors.push(cause); }
  const pending = tickets.filter(row => !row.settled), complete = childIndex ? results.length===6&&results.every(row=>row.comparison.pass)
    &&wrongControls.length===0&&results.reduce((sum,row)=>sum+row.comparison.channelsCompared,0)===13824
    &&['canvas','webgpu'].every(backend=>equal(results.find(row=>row.backend===backend&&row.step==='N1')?.packet.raw,
      results.find(row=>row.backend===backend&&row.step==='N3')?.packet.raw))
    : removeChildren ? results.length===6&&results.every(row=>row.comparison.pass)
    &&wrongControls.length===0&&results.reduce((sum,row)=>sum+row.comparison.channelsCompared,0)===13824
    &&['canvas','webgpu'].every(backend=>equal(results.find(row=>row.backend===backend&&row.step==='N1')?.packet.raw,
      results.find(row=>row.backend===backend&&row.step==='N3')?.packet.raw))
    : nineSlice ? results.length===3&&results.every(row=>row.comparison.pass)
    &&wrongControls.length===0&&results.reduce((sum,row)=>sum+row.comparison.channelsCompared,0)===6912
    &&equal(results[0].packet.raw,results[2].packet.raw)
    : results.length === 6 && results.every(row => row.comparison.pass) && wrongControls.length === 2
    && results.reduce((sum, row) => sum + row.comparison.channelsCompared, 0) === 768;
  const incomplete = pending.length > 0 || cleanupErrors.length > 0 || !stable || browser || server
    || primaryOccurred && ['BIP_NATIVE_TIMEOUT','BIP_NATIVE_DEADLINE','BIP_NATIVE_UNAVAILABLE','BIP_NATIVE_CLOSE_UNSAFE',
      ...(nineSlice?['NLB_NATIVE_TIMEOUT','NLB_NATIVE_DEADLINE','NLB_NATIVE_UNAVAILABLE','NLB_NATIVE_CLOSE_UNSAFE']:[]),
      ...(removeChildren?['DCA_NATIVE_TIMEOUT','DCA_NATIVE_DEADLINE','DCA_NATIVE_UNAVAILABLE','DCA_NATIVE_CLOSE_UNSAFE']:[]),
      ...(childIndex?['CGI_NATIVE_TIMEOUT','CGI_NATIVE_DEADLINE','CGI_NATIVE_UNAVAILABLE','CGI_NATIVE_CLOSE_UNSAFE']:[])].includes(primary?.code);
  const result = { schemaVersion: 1, status: incomplete ? 'INCOMPLETE' : primaryOccurred || !complete ? 'FAIL' : 'PASS',
    scope: childIndex ? 'DisplayObjectContainer.getChildIndex caller reorder/saved replay with live Scope resource/event state; desktop ordinary Canvas/WebGPU only'
      : removeChildren ? 'DisplayObjectContainer.removeChildren desktop Canvas/WebGPU ordinary opaque rectangles; no PNG decoding'
      : nineSlice ? 'NineSliceBitmap default desktop WebGPU literal cropped panel; no PNG decoding' : 'BIP1 bounded desktop default-browser PNG/opaque-transparent-black composition only',
    ...(nineSlice ? {profile,actualNativeMainCases:nineSliceMainEntered?1:0,actualNativeMainPasses:!incomplete&&!primaryOccurred&&complete?1:0,
      canvasRefusalCases:contexts[0]?.fixtureClose?.canvasRefusal?.status==='PASS_REFUSAL_ONLY'?2:0,positiveCanvasSubmissions:0} : {}),
    ...(removeChildren ? {profile,actualNativeMainCases:removeChildrenEntered.size,
      actualNativeMainPasses:!incomplete&&!primaryOccurred&&complete?removeChildrenEntered.size:0,
      positiveCanvasSubmissions:contexts.find(row=>row.backend==='canvas')?.fixtureClose?.ports[0]?.renderSubmissions??0} : {}),
    ...(childIndex ? {profile,actualNativeMainCases:childIndexEntered.size,
      actualNativeMainPasses:!incomplete&&!primaryOccurred&&complete?childIndexEntered.size:0,
      positiveCanvasSubmissions:contexts.find(row=>row.backend==='canvas')?.fixtureClose?.ports[0]?.renderSubmissions??0} : {}),
    admissionPin, startedAtUtc: new Date(startedAt).toISOString(), finishedAtUtc: new Date().toISOString(), browserVersion,
    primaryOccurred, primary: primaryOccurred ? occurrence(primary) : null, cleanupErrors: cleanupErrors.map(occurrence),
    beforeAfterGraphStable: stable, sourceAndInstalledRuntimePinsStable: stable && cleanupErrors.length === 0,
    node: { version: process.version, platform: process.platform, arch: process.arch, execPath: process.execPath },
    installedEdgeExecutablePin: admission.runtime.edgeExecutable,
    tickets, pendingTicketIds: pending.map(row => row.id), contextRetirement: contexts.map(row => ({ backend: row.backend, closeFulfilled: row.closeFulfilled })),
    browserCloseFulfilled, serverCloseFulfilled, wrongOracleControls: wrongControls,
    renderedSubmissions: contexts.length === (nineSlice ? 1 : 2) && contexts.every(row => row.fixtureClose)
      ? contexts.reduce((sum, row) => sum + row.fixtureClose.ports.reduce((total, port) => total + port.renderSubmissions, 0), 0) : null,
    completeRawReadbacks: results.length,
    newCaptures: contexts.length === (nineSlice ? 1 : 2) && contexts.every(row => row.fixtureClose)
      ? contexts.reduce((sum, row) => sum + row.fixtureClose.newCaptures, 0) : null,
    savedReplays: contexts.length === (nineSlice ? 1 : 2) && contexts.every(row => row.fixtureClose)
      ? contexts.reduce((sum, row) => sum + row.fixtureClose.savedReplays, 0) : null,
    pixelsCompared: results.reduce((sum, row) => sum + row.comparison.pixelsCompared, 0),
    channelsCompared: results.reduce((sum, row) => sum + row.comparison.channelsCompared, 0),
    requests, browserEvents, declaredModules: graph.backendClosures,
    requestedModules: schedule.backends.map(backend => ({ backend,
      routes: [...new Set(requests.filter(row => row.backend === backend && graph.moduleRoutes.some(module => module.route === row.route)).map(row => row.route))],
      untouchedDeclaredRoutes: graph.backendClosures.find(row => row.backend === backend).moduleRoutes.filter(route => !requests.some(row => row.backend === backend && row.route === route)) })),
    observedScopeLimits: ['No physical GPU/phone/mini-game/Native SDK/energy/performance/GC acceptance', 'No all-PNG/translucent/HDR/fullSpine/migration/delivery acceptance'],
    timingBudgetMs: { perOperation: 20_000, operationDeadline: 180_000, cleanupDeadline: 220_000, outerContainment: 240_000 } };
  writeJson('result.json', result); return result;
}
