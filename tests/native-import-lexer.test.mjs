// SPDX-License-Identifier: Apache-2.0
// Collector lexical controls; no engine import or module evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { literalImports, resolveSelected, chosenMap } from '../tools/textured-webgpu/native-files.mjs';

test('native import reader accepts a quoted path character class and keeps later imports', () => {
  assert.deepEqual(literalImports(String.raw`if (/[\\\u0000-\u001f\u007f:*?"<>|%#]/u.test(path)) refuse(); import './after.js';`), ['./after.js']);
});
test('native import reader distinguishes escaped slashes and character-class slashes', () => {
  assert.deepEqual(literalImports(String.raw`if (/['"/\\]\/x/iu.test(path)) refuse(); import('./after.js');`), ['./after.js']);
});
test('native import reader treats import-like regex text as data and checks the next actual import', () => {
  assert.deepEqual(literalImports(String.raw`if (/import\(['"]ignored['"]\)/u.test(path)) refuse(); import('./real.js');`), ['./real.js']);
  assert.throws(() => literalImports(String.raw`if (/import/u.test(path)) refuse(); import(name);`), e => e.reason === 'MODULE_IMPORT_LITERAL');
});
test('native import reader keeps real import expressions between division operators', () => {
  assert.deepEqual(literalImports("const value = left / import('./real.js') / right;"), ['./real.js']);
  assert.deepEqual(literalImports("const value = '(' / import('./real.js') / g;"), ['./real.js']);
});
test('native import reader refuses unterminated regexes and character classes', () => {
  for (const source of ['if (/unterminated', 'if (/[unterminated/', 'if (/escaped\\', 'if (/line\nnext/)'])
    assert.throws(() => literalImports(source), e => e.reason === 'MODULE_REGEXP');
});
test('native import reader refuses invalid or duplicate regex flags', () => {
  for (const flags of ['uu', 'z', 'uv', 'v']) assert.throws(() => literalImports('if (/x/' + flags + '.test(path)) {}'), e => e.reason === 'MODULE_REGEXP');
});
test('native import reader keeps exact private-alias lexical and resolver boundaries', () => {
  assert.deepEqual(literalImports("import '#egret-manifest-resources';"), ['#egret-manifest-resources']);
  assert.throws(() => literalImports("import '#egret-manifest-resources-extra';"), e => e.reason === 'MODULE_PRIVATE_ALIAS_UNKNOWN');
  assert.throws(() => literalImports("import '#egret-mouse-input';"), e => e.reason === 'MODULE_PRIVATE_ALIAS_UNKNOWN');
  assert.throws(() => resolveSelected('#egret-manifest-resources', '/packages/engine/dist/web/ManifestByteSource.js', 'baseline', chosenMap('baseline')), e => e.reason === 'PRIVATE_ALIAS_UNKNOWN');
});


test('native import reader accepts actual offline project path validation source', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../packages/project/dist/paths.js', import.meta.url), 'utf8');
  assert.deepEqual(literalImports(source), ['./unicode.js']);
});

test('native import reader keeps real imports after logical-or and unary-not regex data', () => {
  assert.deepEqual(literalImports(String.raw`if (bad || /import(['"]ignored['"])/u.test(path)) refuse(); import './after.js';`), ['./after.js']);
  assert.deepEqual(literalImports(String.raw`const valid = !/['"/\\]/u.test(path); import('./real.js');`), ['./real.js']);
  assert.throws(() => literalImports('const value = "||" / import(name) / right;'), e => e.reason === 'MODULE_IMPORT_LITERAL');
  assert.throws(() => literalImports('const value = "!" / import(name) / right;'), e => e.reason === 'MODULE_IMPORT_LITERAL');
});

test('native import reader refuses malformed regexes in the two added expression contexts', () => {
  for (const prefix of ['const value = !', 'if (bad || '])
    for (const body of ['/unterminated', '/[unterminated/', '/line\nnext/', '/x/uu'])
      assert.throws(() => literalImports(prefix + body), e => e.reason === 'MODULE_REGEXP');
});


// Current source-closure controls; SDK modules are inert bytes, never evaluated.
test('textured source profile admits the genuine current 137 while historical 128, 132 and 134 still refuse', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { collectPublicGraph, LIMITS, sourceCounterpart } = await import('../tools/textured-webgpu/native-files.mjs');
  const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
  assert.deepEqual(LIMITS, {modules:128,moduleBytes:1048576,graphBytes:4194304,artifactBytes:4194304,totalArtifactBytes:16777216,eventsPerWindow:128,requestsPerWindow:512});
  const path = await import('node:path');
  const capture = async profile => {
    const pins = [];
    const graph = await collectPublicGraph(root, (row, role) => pins.push({path:row.path,bytes:row.bytes,sha256:row.sha256,role}), profile);
    return {graph,pins};
  };
  const before = await capture('m22-sequence-textured');
  assert.equal(before.graph.modules.size, 137);
  assert.ok(before.graph.modules.has('packages/contracts/dist/resources/index.js'));
  assert.ok(before.graph.modules.has('packages/runtime/dist/ui/managedState.js'));
  assert.ok(before.graph.modules.has('packages/engine/dist/internal/uiFactoryState.js'));
  assert.ok(!before.graph.modules.has('packages/engine/dist/ui/uiRoot.js'));
  assert.ok(!before.graph.modules.has('packages/runtime/dist/ui/layout.js'));
  assert.ok(before.graph.modules.has('packages/engine/dist/sequenceTargetClaims.js'));
  assert.ok(before.graph.modules.has('packages/engine/dist/internal/sequenceControllerFactoryState.js'));
  assert.ok(!before.graph.modules.has('packages/engine/dist/animation/sequenceController.js'));
  for (const row of before.graph.modules.values()) {
    for (const edge of row.edges) assert.ok(before.graph.modules.has(edge.url.slice(1)));
    const source = sourceCounterpart(row.relative);
    if (source) assert.ok(before.pins.some(pin => pin.role === 'original-source' && pin.path === path.join(root, source)));
  }
  const summary = value => ({modules:[...value.graph.modules.values()].map(row => [row.relative, row.bytes, row.sha256, row.edges]),inputs:value.pins});
  const healthy = async () => assert.deepEqual(summary(await capture('m22-sequence-textured')), summary(before));
  const refusalWithBaseline = async (exercise, label) => {
    const failures = [];
    try { await healthy(); } catch (error) { failures.push(error); }
    if (failures.length === 0) {
      try { await exercise(); } catch (error) { failures.push(error); }
    }
    try { await healthy(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, label);
  };
  await refusalWithBaseline(
    () => assert.rejects(collectPublicGraph(root, () => {}), error => error.reason === 'GRAPH_MODULE_COUNT'),
    'default source profile refusal and complete baseline');
  for (const historical of ['m15-textured', 'm12-recipe5', 'm31-textured']) {
    await refusalWithBaseline(
      () => assert.rejects(collectPublicGraph(root, () => {}, historical), error => error.reason === 'GRAPH_MODULE_COUNT'),
      'historical source profile remains bounded: ' + historical);
  }
  for (const profile of ['unknown', 'm15-textured-extra', 'm31-textured-extra', 'm22-sequence-textured-extra', 134, 136, null]) {
    await refusalWithBaseline(
      () => assert.rejects(collectPublicGraph(root, () => {}, profile), error => error.reason === 'GRAPH_SOURCE_PROFILE'),
      'closed source profile refusal and complete baseline: ' + String(profile));
  }
});

test('textured 132/133 source boundary rejects an actual extra module and restores the complete fixture', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { collectPublicGraph } = await import('../tools/textured-webgpu/native-files.mjs');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-textured-source-cap-')));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const put = (relative, body) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, body);
  };
  const module = (name, body) => {
    put('packages/engine/dist/' + name + '.js', body);
    put('packages/engine/' + (name.startsWith('web/') ? '' : 'src/') + name + '.ts', body);
  };
  fs.mkdirSync(path.join(root, 'packages/engine/node_modules/robust-predicates'), {recursive:true});
  module('index', "export * from './Engine.js';\n");
  module('Engine', "import './internal/texturedFrameState.js';\nimport './r0.js';\n");
  module('internal/texturedFrameState', 'export const registry = {};\n');
  module('web/webgpu', "export * from './WebGPUHost.js';\n");
  module('web/WebGPUHost', "import '#egret-textured-frame-state';\n");
  for (let index = 0; index < 128; index++) module('r' + index,
    index < 126 ? "import './r" + (index + 1) + ".js';\n" : 'export const end = true;\n');
  const collect = async () => {
    const pins = [];
    const graph = await collectPublicGraph(root, (row, role) => pins.push({path:row.path,bytes:row.bytes,sha256:row.sha256,role}), 'm15-textured');
    return {graph,pins};
  };
  const summary = value => ({modules:[...value.graph.modules.values()].map(row => [row.relative, row.bytes, row.sha256, row.edges]),inputs:value.pins});
  const before = await collect(); assert.equal(before.graph.modules.size, 132);
  const last = path.join(root, 'packages/engine/dist/r126.js'), original = fs.readFileSync(last);
  const failures = [];
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length === 0) {
    try {
      fs.writeFileSync(last, "import './r127.js';\n");
      await assert.rejects(collect(), error => error.reason === 'GRAPH_MODULE_COUNT');
    } catch (error) { failures.push(error); }
  }
  try { fs.writeFileSync(last, original); } catch (error) { failures.push(error); }
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, '132/133 refusal, local restoration and complete baseline');
});

test('textured 134/135 UI successor source boundary rejects an actual extra module and restores the complete fixture', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { collectPublicGraph } = await import('../tools/textured-webgpu/native-files.mjs');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-textured-source-cap-')));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const put = (relative, body) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, body);
  };
  const module = (name, body) => {
    put('packages/engine/dist/' + name + '.js', body);
    put('packages/engine/' + (name.startsWith('web/') ? '' : 'src/') + name + '.ts', body);
  };
  fs.mkdirSync(path.join(root, 'packages/engine/node_modules/robust-predicates'), {recursive:true});
  module('index', "export * from './Engine.js';\n");
  module('Engine', "import './internal/texturedFrameState.js';\nimport './r0.js';\n");
  module('internal/texturedFrameState', 'export const registry = {};\n');
  module('web/webgpu', "export * from './WebGPUHost.js';\n");
  module('web/WebGPUHost', "import '#egret-textured-frame-state';\n");
  for (let index = 0; index < 130; index++) module('r' + index,
    index < 128 ? "import './r" + (index + 1) + ".js';\n" : 'export const end = true;\n');
  const collect = async () => {
    const pins = [];
    const graph = await collectPublicGraph(root, (row, role) => pins.push({path:row.path,bytes:row.bytes,sha256:row.sha256,role}), 'm31-textured');
    return {graph,pins};
  };
  const summary = value => ({modules:[...value.graph.modules.values()].map(row => [row.relative, row.bytes, row.sha256, row.edges]),inputs:value.pins});
  const before = await collect(); assert.equal(before.graph.modules.size, 134);
  const last = path.join(root, 'packages/engine/dist/r128.js'), original = fs.readFileSync(last);
  const failures = [];
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length === 0) {
    try {
      fs.writeFileSync(last, "import './r129.js';\n");
      await assert.rejects(collect(), error => error.reason === 'GRAPH_MODULE_COUNT');
    } catch (error) { failures.push(error); }
  }
  try { fs.writeFileSync(last, original); } catch (error) { failures.push(error); }
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, '134/135 refusal, local restoration and complete baseline');
});

test('textured 137/138 sequence successor source boundary rejects an actual extra module and restores the complete fixture', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { collectPublicGraph } = await import('../tools/textured-webgpu/native-files.mjs');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-textured-source-cap-')));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const put = (relative, body) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, body);
  };
  const module = (name, body) => {
    put('packages/engine/dist/' + name + '.js', body);
    put('packages/engine/' + (name.startsWith('web/') ? '' : 'src/') + name + '.ts', body);
  };
  fs.mkdirSync(path.join(root, 'packages/engine/node_modules/robust-predicates'), {recursive:true});
  module('index', "export * from './Engine.js';\n");
  module('Engine', "import './internal/texturedFrameState.js';\nimport './r0.js';\n");
  module('internal/texturedFrameState', 'export const registry = {};\n');
  module('web/webgpu', "export * from './WebGPUHost.js';\n");
  module('web/WebGPUHost', "import '#egret-textured-frame-state';\n");
  for (let index = 0; index < 133; index++) module('r' + index,
    index < 131 ? "import './r" + (index + 1) + ".js';\n" : 'export const end = true;\n');
  const collect = async () => {
    const pins = [];
    const graph = await collectPublicGraph(root, (row, role) => pins.push({path:row.path,bytes:row.bytes,sha256:row.sha256,role}), 'm22-sequence-textured');
    return {graph,pins};
  };
  const summary = value => ({modules:[...value.graph.modules.values()].map(row => [row.relative, row.bytes, row.sha256, row.edges]),inputs:value.pins});
  const before = await collect(); assert.equal(before.graph.modules.size, 137);
  const last = path.join(root, 'packages/engine/dist/r131.js'), original = fs.readFileSync(last);
  const failures = [];
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length === 0) {
    try {
      fs.writeFileSync(last, "import './r132.js';\n");
      await assert.rejects(collect(), error => error.reason === 'GRAPH_MODULE_COUNT');
    } catch (error) { failures.push(error); }
  }
  try { fs.writeFileSync(last, original); } catch (error) { failures.push(error); }
  try { assert.deepEqual(summary(await collect()), summary(before)); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, '137/138 refusal, local restoration and complete baseline');
});
