// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const tool=await import('../../tools/browser-history.mjs').catch(()=>({}));
test('historical migration exposes a finite prepare/run workflow',()=>{
 assert.equal(typeof tool.parseHistoryOptions,'function');
 for(const suite of ['textured-webgpu','textured-scene','sequence-player','sequence-playback','spritesheet']){
  const args=['prepare','--suite',suite,'--playwright',path.resolve('pw'),'--output',path.resolve('fresh')];
  if(['sequence-playback','spritesheet'].includes(suite))args.push('--admission',path.resolve('admission.json'),'--admission-sha256','a'.repeat(64));
  assert.equal(tool.parseHistoryOptions(args).suite,suite);
 }
});
test('missing admission, duplicate switches, unknown suites and digest errors fail closed',()=>{
 assert.equal(typeof tool.parseHistoryOptions,'function');
 for(const args of [[],['prepare','--suite','unknown'],['run','--manifest',path.resolve('x'),'--sha256','bad'],['run','--manifest',path.resolve('x'),'--sha256','a'.repeat(64),'--sha256','b'.repeat(64)],['prepare','--suite','spritesheet','--playwright',path.resolve('pw'),'--output',path.resolve('fresh')]])assert.throws(()=>tool.parseHistoryOptions(args));
});
test('raw snapshot verification rejects byte drift, missing and duplicated inputs',()=>{
 assert.equal(typeof tool.verifyHistoryPins,'function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'egret-history-'));
 try{const file=path.join(dir,'input');fs.writeFileSync(file,'x\n');const pin=tool.historyPin(file);
  assert.doesNotThrow(()=>tool.verifyHistoryPins([pin]));
  assert.throws(()=>tool.verifyHistoryPins([pin,pin]));assert.throws(()=>tool.verifyHistoryPins([]));
  fs.writeFileSync(file,'x\r\n');assert.throws(()=>tool.verifyHistoryPins([pin]));fs.unlinkSync(file);assert.throws(()=>tool.verifyHistoryPins([pin]));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a success label alone never earns historical suite credit',()=>{
 assert.equal(typeof tool.validateHistoryCompletion,'function');
 for(const suite of ['textured-webgpu','textured-scene','sequence-player','sequence-playback','spritesheet'])for(const value of [{status:'PASS'},{status:'PASS_SPRITESHEET_OPAQUE_SUBSET'},{}])assert.throws(()=>tool.validateHistoryCompletion(suite,value));
});
test('selected current collectors admit Node26 and exact hoisted owners',()=>{
 for(const file of ['freeze-textured-webgpu-inputs.mjs','textured-webgpu/collector.mjs','verify-textured-scene-webgpu.mjs','sequence-player/collector.mjs','sequence-playback/collector.mjs','spritesheet/collector.mjs']){
  const source=fs.readFileSync(new URL('../../tools/'+file,import.meta.url),'utf8');
  assert.ok(source.includes('26.7.0'),file);assert.ok(!source.includes("process.version === 'v24.19.0'")&&!source.includes("process.version==='v24.19.0'"),file);
 }
});

test('complete clock receipt refuses a missing replay, owner recheck or cleanup',()=>{
 for(const suite of ['sequence-playback','spritesheet']){
  const steps=['1','2','3','4','5','6','7','8','9'];
  const good={environment:{node:'v26.7.0',browserVersion:'fixture'},status:suite==='spritesheet'?'PASS_SPRITESHEET_OPAQUE_SUBSET':'PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET',completedCaptures:18,comparedPixels:576,comparedChannels:2304,firstError:null,overflow:false,identitiesStable:true,retirement:{browser:'closed',server:'closed',contexts:[{state:'closed'},{state:'closed'}],fixtures:[{},{}]},requestedStepsPerBackend:steps,captures:['canvas','webgpu'].flatMap(backend=>steps.map(step=>({backend,step,observation:{pass:true}}))),completedNewCaptures:16,completedReplays:2,compilerOwnership:{stable:true},workspaceOwnership:{stable:true}};
  assert.doesNotThrow(()=>tool.validateHistoryCompletion(suite,good));
  for(const mutate of [r=>r.completedReplays=1,r=>r.compilerOwnership.stable=false,r=>r.retirement.server='unresolved',r=>r.captures.pop(),r=>r.firstError={message:'failure'}]){const bad=structuredClone(good);mutate(bad);assert.throws(()=>tool.validateHistoryCompletion(suite,bad));}
 }
});

test('the current source ledger has its own finite cap without enlarging module limits',async()=>{
 const native=await import('../../tools/textured-webgpu/native-files.mjs');assert.equal(typeof native.inputByteLimit,'function');
 assert.equal(native.inputByteLimit('source-origin.json'),4194304);
 for(const name of ['packages/engine/dist/index.js','elsewhere/source-origin.json','SOURCE-ORIGIN.JSON'])assert.equal(native.inputByteLimit(name),1048576);
 assert.equal(native.LIMITS.moduleBytes,1048576);
});

test('mixed-scene success with incomplete final retirement is refused',()=>{
 const receipt={environment:{node:'v26.7.0',browserVersion:'fixture'},status:'PASS',exitCode:0,rawCheck:{status:'PASS',observations:2,checkedPixels:24},sensitivity:{status:'EXPECTED_PIXEL_REJECTION'},safeNative:{status:'PASS'},lifecycle:{pageClosed:true,contextClosed:true,browserClosed:true,serverClosed:true,identitiesStable:true,artifactsStable:true,pendingOperations:0,lateAcquisitionsSettled:true,cooperativeAPIClosure:true},failure:null,cleanupFailures:[],browserEvents:[]};
 assert.doesNotThrow(()=>tool.validateHistoryCompletion('textured-scene',receipt));
 for(const key of ['browserClosed','identitiesStable','artifactsStable','cooperativeAPIClosure']){const bad=structuredClone(receipt);bad.lifecycle[key]=false;assert.throws(()=>tool.validateHistoryCompletion('textured-scene',bad));}
});


// Execute the actual finite collector policy in isolation. SDK modules are read
// as inert source bytes; neither the native entry nor emitted SDK code executes.
const { runInNewContext } = await import('node:vm');
const { createHash } = await import('node:crypto');
const { fileURLToPath, pathToFileURL } = await import('node:url');
const repository = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
async function currentMixedCollectorPolicy() {
 const source = fs.readFileSync(path.join(repository, 'tools/verify-textured-scene-webgpu.mjs'), 'utf8');
 const start = source.indexOf('const REGISTRY = '), end = source.indexOf('function numericFault(cause)');
 assert.ok(start >= 0 && end > start, 'The actual finite collection policy must be present');
 return runInNewContext(source.slice(start, end) + '\n({ collectGraph, ENTRIES, literalImports })', {
  path, process, URL, TextDecoder, createHash,
  readFile: fs.promises.readFile, realpath: fs.promises.realpath, lstat: fs.promises.lstat,
 }, { timeout: 1000 });
}
function assertTwoMixedLazyEdges(graph) {
 assert.deepEqual(Array.from(graph.dynamicEdges, row => [row.parent, row.specifier, row.url]).sort((a, b) => a[1].localeCompare(b[1])), [
  ['packages/engine/dist/web/WebGPUHost.js', './b1.js', '/packages/engine/dist/web/b1.js'],
  ['packages/engine/dist/web/WebGPUHost.js', './sharedB1.js', '/packages/engine/dist/web/sharedB1.js'],
 ]);
}
test('the mixed-scene collector seals both current lazy B1 closures without evaluating the SDK', async t => {
 const policy = await currentMixedCollectorPolicy(), pins = [];
 const graph = await policy.collectGraph(repository, fs.realpathSync(path.join(repository, 'packages/engine/node_modules/robust-predicates')), (row, role) => pins.push({ ...row, role }));
 assertTwoMixedLazyEdges(graph);
 assert.ok(graph.modules.size <= 256); assert.ok(graph.totalBytes <= 8388608);
 assert.ok(graph.modules.has('/packages/engine/dist/web/sharedB1.js'));
 assert.ok(graph.modules.has('/packages/contracts/dist/resources/index.js'));
 for (const row of graph.modules.values()) {
  for (const edge of row.edges) assert.ok(graph.modules.has(edge.url), 'Every transitive import is retained');
  assert.ok(pins.some(pin => pin.path === row.path && pin.sha256 === row.sha256));
  if (row.firstParty) assert.ok(pins.some(pin => pin.role === 'public-source' && pin.path === row.source.path && pin.sha256 === row.source.sha256));
 }
 t.diagnostic('Actual mixed emitted closure: ' + graph.modules.size + ' modules; SDK code was never evaluated');
});
function putFixture(root, relative, body) {
 const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body);
}
function mixedFixture(root) {
 const entries = {
  'src/index': "export * from './Engine.js';\n",
  'src/Engine': "import './internal/texturedFrameState.js';\n",
  'src/internal/texturedFrameState': 'export const registry = {};\n',
  'rendering/scene3d': 'export const scene = true;\n',
  'web/scene3d': "export * from './WebGPUHost.js';\n",
  'web/webgpu': "export * from './WebGPUHost.js';\n",
  'web/WebGPUHost': "import '#egret-textured-frame-state';\nimport('./b1.js');\nimport('./sharedB1.js');\n",
  'web/b1': 'export const legacy = true;\n',
  'web/sharedB1': "export * from './sharedLeaf.js';\n",
  'web/sharedLeaf': 'export const shared = true;\n',
  'web/other': 'export const other = true;\n',
 };
 for (const [name, body] of Object.entries(entries)) {
  putFixture(root, 'packages/engine/' + name + '.ts', body);
  putFixture(root, 'packages/engine/dist/' + name.replace(/^src\//, '') + '.js', body);
 }
 fs.mkdirSync(path.join(root, 'robust'), { recursive: true });
}
const mixedRefusals = [
 ['unknown Host target', 'web/WebGPUHost', "import '#egret-textured-frame-state';\nimport('./b1.js');\nimport('./other.js');\n", 'DYNAMIC_EDGE_BOUND'],
 ['different importer', 'web/sharedB1', "import('./b1.js');\n", 'DYNAMIC_EDGE_BOUND'],
 ['missing required lazy edge', 'web/WebGPUHost', "import '#egret-textured-frame-state';\nimport('./b1.js');\n", 'GRAPH_REQUIRED_IDENTITIES'],
 ['duplicate legacy edge cannot substitute for shared B1', 'web/WebGPUHost', "import '#egret-textured-frame-state';\nimport('./b1.js');\nimport('./b1.js');\n", 'GRAPH_REQUIRED_IDENTITIES'],
];
for (const [name, target, mutant, reason] of mixedRefusals) test('mixed-scene lazy admission refuses ' + name + ' after a fresh healthy closure', async t => {
 const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-mixed-graph-')));
 t.after(() => fs.rmSync(root, { recursive: true, force: true })); mixedFixture(root);
 const policy = await currentMixedCollectorPolicy();
 const collect = () => policy.collectGraph(root, path.join(root, 'robust'), () => {});
 const before = await collect(); assertTwoMixedLazyEdges(before);
 assert.ok(before.modules.has('/packages/engine/dist/web/sharedLeaf.js'));
 const file = path.join(root, 'packages/engine/dist/' + target + '.js'), original = fs.readFileSync(file);
 try {
  fs.writeFileSync(file, mutant);
  await assert.rejects(collect(), error => error.reason === reason);
 } finally { fs.writeFileSync(file, original); }
 assertTwoMixedLazyEdges(await collect());
});
async function actualSequenceGraph(suite) {
 const source = fs.readFileSync(path.join(repository, 'tools', suite, 'collector.mjs'), 'utf8');
 const start = source.indexOf('  const aliases = {'), graphStart = source.indexOf('  const graph = await bounded(', start);
 const end = source.indexOf('} }));', graphStart);
 assert.ok(start >= 0 && graphStart > start && end > graphStart, 'The actual alias and collection call must be present');
 const helper = await import(pathToFileURL(path.join(repository, 'tools', suite, 'file-graph.mjs')).href);
 let selected;
 const graph = await runInNewContext('(async () => {\n' + source.slice(start, end + 6) + '\nreturn graph; })()', {
  repositoryRoot: repository, path,
  bounded: (_label, operation) => operation(),
  sealGraph: options => { selected = options; return helper.sealGraph(options); },
 }, { timeout: 1000 });
 const budget = source.match(/budgets: (\{[^}]+\})/);
 assert.ok(budget, 'The actual report budget must be present');
 const reportedBudget = runInNewContext('(' + budget[1] + ')', {}, { timeout: 1000 });
 return { graph, selected, helper, reportedBudget };
}
for (const suite of ['sequence-player', 'sequence-playback', 'spritesheet']) test(suite + ' collector admits the complete current union while retaining count and byte refusals', async t => {
 const { graph, selected, helper, reportedBudget } = await actualSequenceGraph(suite);
 assert.equal(reportedBudget.selectedModules, selected.maxModules, 'Reported module budget must match the actual admitted collection');
 assert.equal(reportedBudget.emittedBytes, 4194304, 'The original emitted-byte budget is retained');
 assert.ok(graph.modules.length > 128 && graph.modules.length <= 256);
 assert.ok(graph.totalBytes <= 4194304);
 assert.ok(graph.closures.canvas.every(file => !/[\\/]WebGPUHost\.js$|[\\/]sharedB1\.js$/.test(file)));
 assert.ok(graph.closures.webgpu.some(file => /[\\/]sharedB1\.js$/.test(file)));
 assert.ok(graph.modules.some(row => row.path.endsWith(path.join('contracts', 'dist', 'resources', 'index.js'))));
 for (const row of graph.modules) for (const edge of row.edges) assert.ok(graph.modules.some(candidate => candidate.path === edge.target));
 await assert.rejects(helper.sealGraph({ repositoryRoot: repository, aliases: selected.aliases, entryPaths: selected.entryPaths }), /Module-count budget exceeded/);
 const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-sequence-graph-')));
 t.after(() => fs.rmSync(root, { recursive: true, force: true }));
 for (let index = 0; index < 257; index++) {
  const body = index === 256 ? 'export const end = true;\n' : "import './m" + (index + 1) + ".js';\n";
  putFixture(root, 'packages/runtime/dist/m' + index + '.js', body);
  putFixture(root, 'packages/runtime/src/m' + index + '.ts', body);
 }
 const options = { repositoryRoot: root, aliases: {}, entryPaths: { webgpu: [path.join(root, 'packages/runtime/dist/m0.js')] }, maxModules: selected.maxModules };
 const lastAdmitted = path.join(root, 'packages/runtime/dist/m255.js'), originalEdge = fs.readFileSync(lastAdmitted);
 fs.writeFileSync(lastAdmitted, 'export const end = true;\n');
 assert.equal((await helper.sealGraph(options)).modules.length, 256);
 fs.writeFileSync(lastAdmitted, originalEdge);
 await assert.rejects(helper.sealGraph(options), /Module-count budget exceeded/);
 fs.writeFileSync(lastAdmitted, 'export const end = true;\n');
 assert.equal((await helper.sealGraph(options)).modules.length, 256);
 const firstModule = path.join(root, 'packages/runtime/dist/m0.js'), originalFirst = fs.readFileSync(firstModule);
 try {
  fs.writeFileSync(firstModule, ' '.repeat(4194305));
  await assert.rejects(helper.sealGraph(options), /Module-byte budget exceeded/);
 } finally { fs.writeFileSync(firstModule, originalFirst); }
 assert.equal((await helper.sealGraph(options)).modules.length, 256);
 t.diagnostic('Actual dual-backend union: ' + graph.modules.length + ' modules; original helper default and 4 MiB cap remain enforced');
});

// M15-HISTORICAL-RESOURCE-LEXER-BEGIN
// Actual tool-source readers only; no emitted SDK code or native collector executes.
for (const suite of ['mixed-scene', 'sequence-player', 'sequence-playback', 'spritesheet']) {
 test(suite + ' reader admits current resource regex data while preserving import refusals', async () => {
  let read;
  if (suite === 'mixed-scene') {
   const policy = await currentMixedCollectorPolicy();
   read = source => Array.from(policy.literalImports(source), row => row.specifier);
  } else {
   const source = fs.readFileSync(path.join(repository, 'tools', suite, 'file-graph.mjs'), 'utf8');
   const begin = source.indexOf('function tokens(text) {'), end = source.indexOf('function sourceCounterpart(');
   assert.ok(begin >= 0 && end > begin, 'The actual original reader must be present');
   const reader = runInNewContext(source.slice(begin, end) + '\nimports', {}, { timeout: 1000 });
   read = source => Array.from(reader(source), row => row.value);
  }
  const actualPath = path.join(repository, 'packages/contracts/dist/resources/manifestAdmission.js');
  const actual = fs.readFileSync(actualPath, 'utf8');
  const healthy = () => {
   const current = fs.readFileSync(actualPath, 'utf8');
   assert.equal(current, actual, 'the genuine resource source remains byte-identical');
   assert.deepEqual(read(current), ['./sha256.js']);
   assert.deepEqual(read("import './healthy.js';"), ['./healthy.js']);
  };
  healthy();
  for (const row of [
  {
    "label": "actual path class",
    "source": "if (/[\\\\\\u0000-\\u001f\\u007f:*?\"<>|%#]/u.test(path)) refuse(); import './after.js';",
    "expected": [
      "./after.js"
    ]
  },
  {
    "label": "escaped and class slashes",
    "source": "if (/['\"/\\\\]\\/x/iu.test(path)) refuse(); import('./after.js');",
    "expected": [
      "./after.js"
    ]
  },
  {
    "label": "regex import text",
    "source": "if (bad || /import\\(['\"]ignored['\"]\\)/u.test(path)) refuse(); import './after.js';",
    "expected": [
      "./after.js"
    ]
  },
  {
    "label": "unary not",
    "source": "const valid = !/['\"/\\\\]/u.test(path); import('./after.js');",
    "expected": [
      "./after.js"
    ]
  },
  {
    "label": "division and quoted prefix",
    "source": "const value = '(' / import('./after.js') / right;",
    "expected": [
      "./after.js"
    ]
  }
]) {
   healthy();
   assert.deepEqual(read(row.source), row.expected, row.label);
  }
  for (const bad of [
  "if (/unterminated",
  "if (/[unterminated/",
  "if (/escaped\\",
  "if (/line\nnext/)",
  "if (/x/uu.test(path)) {}",
  "if (bad || /x/v.test(path)) {}",
  "const valid = !/[unterminated/",
  "const value = '||' / import(name) / right;",
  "const value = '!' / import(name) / right;",
  "import(name);",
  "import('./after.js', {});",
  "import.meta.url;",
  "const value = `import('./hidden.js')`;"
]) {
   const failures = [];
   try { healthy(); } catch (error) { failures.push(error); }
   if (failures.length === 0) {
    try { assert.throws(() => read(bad)); } catch (error) { failures.push(error); }
   }
   try { healthy(); } catch (error) { failures.push(error); }
   if (failures.length) throw new AggregateError(failures, suite + ' literal refusal and genuine source baseline');
  }
 });
}
// M15-HISTORICAL-RESOURCE-LEXER-END
