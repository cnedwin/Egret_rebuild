import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,symlinkSync,rmSync,realpathSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('..', import.meta.url));
const parent = path.join(repository, 'work');
const gpuValues = ['createTexturedWebGPUHost', 'createWebGPUHost'];
const gpuTypes = ['TexturedWebGPUHost', 'TexturedWebGPUHostOptions', 'TexturedWebGPUHostStatus'];
const checked = (result, status, reason) => {
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'policy checker exited without a signal');
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (reason) assert.ok(result.stderr.includes(reason), result.stderr);
  else assert.match(result.stdout, /Boundary check PASS/);
};

// First-party scaffold derived from tests/project-boundaries.test.mjs.
// These are isolated actual-package source-policy trials, not native GPU tests.
// Existing workspace names resolve through owned local junctions to one copy.
function isolated(action) {
  mkdirSync(parent, {recursive:true});
  const fixture = mkdtempSync(path.join(parent, 'textured-gpu-boundary-'));
  const checker = readFileSync(path.join(repository, 'tools/check-boundaries.mjs'));
  const checkerHash = createHash('sha256').update(checker).digest('hex');
  const write = (relative, content) => {
    const file = path.join(fixture, relative);
    mkdirSync(path.dirname(file), {recursive:true});
    writeFileSync(file, content);
  };
  const edit = (relative, change) => write(relative, change(readFileSync(path.join(fixture, relative), 'utf8')));
  try {
    for (const name of ['contracts', 'runtime', 'engine', 'project']) {
      for (const entry of ['package.json','tsconfig.json','src','dist',...(name === 'engine' ? ['web','rendering','tsconfig.web.json','tsconfig.rendering.json'] : [])])
        cpSync(path.join(repository, 'packages', name, entry), path.join(fixture, 'packages', name, entry), {recursive:true});
      mkdirSync(path.join(fixture, 'node_modules/@egret'), {recursive:true});
      const packageRoot = path.join(fixture, 'packages', name);
      const packageLink = path.join(fixture, 'node_modules/@egret', name);
      symlinkSync(packageRoot, packageLink, 'junction');
      assert.equal(realpathSync(packageLink), realpathSync(packageRoot));
    }
    for (const name of ['jsonc-parser','robust-predicates']) {
      const require = createRequire(path.join(repository, 'packages', name === 'jsonc-parser' ? 'project' : 'engine', 'package.json'));
      const entry = realpathSync(require.resolve(name));
      const installed = name === 'jsonc-parser' ? path.resolve(path.dirname(entry), '../..') : path.dirname(entry);
      cpSync(installed, path.join(fixture, 'node_modules', name), {recursive:true});
    }

    write('tools/check-boundaries.mjs', checker);
    assert.equal(createHash('sha256').update(readFileSync(path.join(fixture, 'tools/check-boundaries.mjs'))).digest('hex'), checkerHash);
    const check = () => spawnSync(process.execPath, ['tools/check-boundaries.mjs'], {cwd:fixture,encoding:'utf8',maxBuffer:8*1024*1024});
    return action({fixture,write,edit,check,checkerHash});
  } finally {
    const resolved = realpathSync(fixture);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep) && path.basename(resolved).startsWith('textured-gpu-boundary-'));
    for (const name of ['contracts','runtime','engine','project']) {
      const link = path.join(resolved, 'node_modules/@egret', name);
      if (existsSync(link)) assert.equal(realpathSync(link), realpathSync(path.join(resolved, 'packages', name)), 'cleanup junction stays in the owned copied graph');
    }
    rmSync(resolved, {recursive:true,force:true});
    assert.equal(existsSync(resolved), false);
  }
}

test('T01 actual public facades expose exactly two lexical GPU factories and preserve root/Canvas isolation', async () => {
  const gpu = await import('@egret/engine/webgpu');
  const root = await import('@egret/engine');
  const canvas = await import('@egret/engine/web');
  assert.deepEqual(Object.keys(gpu), gpuValues);
  assert.deepEqual(Object.keys(canvas), ['createCanvasHost']);
  for (const name of gpuValues) {
    assert.equal(typeof gpu[name], 'function');
    assert.equal(Object.hasOwn(root, name), false);
    assert.equal(Object.hasOwn(canvas, name), false);
  }
  for (const name of gpuTypes) assert.equal(Object.hasOwn(gpu, name), false, `${name} is type-only`);
});

test('T02 actual-copy valid two-factory graph is admitted by the unchanged production boundary checker', t => isolated(f => {
  checked(f.check(), 0);
  t.diagnostic(`Actual four-package graph, four existing workspace bindings to owned package copies, unmodified checker SHA256 ${f.checkerHash}; no GPU execution.`);
}));

const entries = {
  contracts:'packages/contracts/dist/index',
  runtime:'packages/runtime/dist/index',
  root:'packages/engine/dist/index',
  web:'packages/engine/dist/web/index',
  webgpu:'packages/engine/dist/web/webgpu',
};
const privateCases = [
  {name:'ledger-class-real-type-reexport',entry:'root',suffix:'.d.ts',addition:"export type {TexturedPreparationBudget2D as EscapedBudget} from './rendering/texturedPreparationBudget2D.js';\n",reason:'root: private textured GPU port leaked: TexturedPreparationBudget2D'},
  {name:'tuple-type',entry:'webgpu',suffix:'.d.ts',addition:'export interface MeshPoint2D {}\n',reason:'webgpu: private textured GPU port leaked: MeshPoint2D'},
  {name:'admission-record',entry:'runtime',suffix:'.d.ts',addition:'export interface TexturedFrameAdmission2D {}\n',reason:'runtime: private textured GPU port leaked: TexturedFrameAdmission2D'},
  {name:'submission-plan',entry:'contracts',suffix:'.d.ts',addition:'export interface TexturedSubmissionPlan2D {}\n',reason:'contracts: private textured GPU port leaked: TexturedSubmissionPlan2D'},
  {name:'pass-encoder',entry:'web',suffix:'.d.ts',addition:'export declare function encodeWebGPUTexturedMesh(): void;\n',reason:'web: private textured GPU port leaked: encodeWebGPUTexturedMesh'},
  {name:'mode-value',entry:'webgpu',suffix:'.js',addition:'export const TEXTURED_MODE = Symbol();\n',reason:'webgpu: private textured GPU port leaked: TEXTURED_MODE'},
  {name:'actual-payload-function-table-type',entry:'webgpu',suffix:'.d.ts',addition:'export interface TexturedPayloadOperations2D {}\n',reason:'webgpu: private textured GPU port leaked: TexturedPayloadOperations2D'},
  {name:'function-table-declaration',entry:'root',suffix:'.d.ts',addition:'export declare const TEXTURED_FUNCTIONS: object;\n',reason:'root: private textured GPU port leaked: TEXTURED_FUNCTIONS'},
  {name:'aliased-module-only',entry:'root',suffix:'.d.ts',addition:"export type * from './rendering/texturedPreparationBudget2D.js';\n",reason:'root: private textured GPU module leaked: texturedPreparationBudget2D'},
  {name:'owned-invocation-origin',entry:'webgpu',suffix:'.d.ts',addition:'export declare function runOwnedPreparationScope(): void;\n',reason:'webgpu: private textured GPU port leaked: runOwnedPreparationScope'},
  {name:'actual-textured-pipeline-type-alias',entry:'root',suffix:'.d.ts',addition:"export type {createWebGPUTexturedPipeline as EscapedPass} from './web/webgpuTexturedPass.js';\n",reason:'root: private textured GPU port leaked: createWebGPUTexturedPipeline'},
  {name:'actual-textured-pass-module-alias',entry:'root',suffix:'.d.ts',addition:"export type * as EscapedPass from './web/webgpuTexturedPass.js';\n",reason:'root: private textured GPU module leaked: webgpuTexturedPass'},
  {name:'actual-textured-options-admission-type-alias',entry:'root',suffix:'.d.ts',addition:"export type {admitTexturedWebGPUOptions as EscapedOptions} from './web/texturedWebGPUOptions.js';\n",reason:'root: private textured GPU port leaked: admitTexturedWebGPUOptions'},
  {name:'actual-textured-options-weakmap-declaration',entry:'root',suffix:'.d.ts',addition:'export declare const TEXTURED_OPTIONS: object;\n',reason:'root: private textured GPU port leaked: TEXTURED_OPTIONS'},
  // Registry and B1 keep their already accepted classifications.
  {name:'registry-retained-reason',entry:'root',suffix:'.d.ts',addition:'export declare function readOwnedTexturedFrame(): undefined;\n',reason:'root: private textured-frame authority leaked: readOwnedTexturedFrame'},
  {name:'b1-retained-reason',entry:'web',suffix:'.d.ts',addition:'export interface B1SceneStatus {}\n',reason:'web: private rendering port leaked: B1SceneStatus'},
];
for (const item of privateCases) test(`T03 ${item.name} refuses its assigned source-policy reason after a valid actual graph`, t => isolated(f => {
  checked(f.check(), 0);
  const file = entries[item.entry]+item.suffix;
  f.edit(file, raw => raw+'\n'+item.addition);
  checked(f.check(), 1, item.reason);
  t.diagnostic(`${item.name}: ${file}; ${item.reason}`);
}));

for (const entry of ['contracts','runtime','root','web']) for (const name of gpuTypes)
  test(`T04 ${entry} refuses GPU-only type ${name} after a valid actual graph`, () => isolated(f => {
    checked(f.check(), 0);
    f.edit(entries[entry]+'.d.ts', raw => raw+`\nexport interface ${name} {}\n`);
    checked(f.check(), 1, `${entry}: GPU-only textured host type leaked: ${name}`);
  }));

test('T05 retained B1 interfaces and factory remain unchanged in emitted declarations', () => {
  const declaration = readFileSync(path.join(repository, 'packages/engine/dist/web/b1.d.ts'), 'utf8');
  const normalized = value => value.replace(/\s+/g, ' ').trim();
  const expected = [
    "export interface B1SceneStatus { readonly host: WebGPUHostStatus; readonly pendingSceneBytes: number; readonly pendingUniformBytes: number; readonly pendingDepthBytes: number; }",
    "export interface B1WebGPUHost extends WebGPUHost { renderSceneFrame(scene: SceneFrame3D, overlay: RenderFrame2D): undefined; getSceneStatus(): B1SceneStatus; }",
    "export declare function createB1WebGPUHost(options: WebGPUHostOptions): B1WebGPUHost;",
  ];
  const compact = normalized(declaration);
  for (const contract of expected) assert.ok(compact.includes(contract), contract);
});

for (const addition of [
  'export interface ExtraTexturedGPUType {}\n',
  "export type {WebGPUHost as ExtraHostAlias} from './WebGPUHost.js';\n",
]) test('T06 undeclared GPU type addition '+addition.trim()+' refuses the exact facade after a valid actual graph', () => isolated(f => {
  checked(f.check(), 0);
  f.edit(entries.webgpu+'.d.ts', raw => raw+'\n'+addition);
  checked(f.check(), 1, 'webgpu: exact type-only host export surface mismatch');
}));
