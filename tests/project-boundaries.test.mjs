import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {repository,run,isolated,prepareTypeFixture} from './helpers/project-fixture.mjs';

const values=['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
const types=['ProjectId','EntityId','FileId','TransactionId','ProjectRevision','Sha256','JsonValue','JsonObject','ProjectVersionPins','ProjectReference','ProjectEntity','ProjectFileRole','ProjectFile','ProjectSnapshot','ProjectTransactionSource','ProjectTransactionScope','ProjectOperation','ProjectEditTransaction','ProjectRestoreTransaction','ProjectTransaction','ProjectHistory','ProjectDiff','ProjectDiagnosticCode','ProjectDiagnostic','ProjectValueResult','ProjectTransactionReceipt','ProjectCommitResult','ProjectLimits','ProjectStore'];

test('actual built public root contains precisely the six values and 29 type-only exports',async()=>{
  assert.deepEqual(Object.keys(await import('@egret/project')),values);
  const appendix=readFileSync(path.join(repository,'tests/fixtures/project/api-signatures.txt'),'utf8');
  assert.deepEqual([...appendix.matchAll(/^export (?:type|interface) (\w+)/gm)].map(match=>match[1]).sort(),[...types].sort());
  const declaration=readFileSync(path.join(repository,'packages/project/dist/index.d.ts'),'utf8');
  const exported=[...declaration.matchAll(/export type\s*\{([^}]+)\}/g)].flatMap(match=>match[1].split(',').map(value=>value.trim()));
  assert.deepEqual(exported.sort(),[...types].sort());
  assert.equal(new Set(exported).size,29);
});

test('actual package copies with one contracts identity bridge preserve approved renderer entries',()=>isolated(({check})=>{
  const result=check();assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/Boundary check PASS/);
}));

// The fresh genuine baseline must share the factory before testing duplicate identity.
test('copied WebGL2 Host identity refuses an unbridged resolution copy and restores the baseline',()=>isolated(({root,write,check})=>{
  const relative='node_modules/@egret/engine/dist/web/WebGL2Host.js';
  const canonical=path.join(root,'packages/engine/dist/web/WebGL2Host.js');
  const original=readFileSync(canonical),bridge=readFileSync(path.join(root,relative));
  const baseline=check();assert.ifError(baseline.error);assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
  try {
    write(relative,original.toString('utf8'));
    assert.deepEqual(readFileSync(canonical),original);
    const refused=check();assert.ifError(refused.error);assert.equal(refused.status,1,refused.stdout+refused.stderr);
    assert.match(refused.stderr,/M14: exact WebGL2 runtime facade mismatch/);
  } finally {
    write(relative,bridge.toString('utf8'));assert.deepEqual(readFileSync(path.join(root,relative)),bridge);
    assert.deepEqual(readFileSync(canonical),original);
    const restored=check();assert.ifError(restored.error);assert.equal(restored.status,0,restored.stdout+restored.stderr);
  }
}));
const manifest=(fixture,name,mutate)=>fixture.edit(`packages/${name}/package.json`,raw=>{const pkg=JSON.parse(raw);mutate(pkg);return JSON.stringify(pkg);});
const mutations=[
  ['unknown UI named import',f=>f.edit('packages/engine/src/ui/uiRoot.ts',raw=>raw.replace('captureUiLayout, planUiLayout, UiHeightIndex, createUiDisplayOperations','captureUiLayout, planUiLayout, UiHeightIndex, createUiDisplayOperations, hiddenUiAuthority')),/unapproved named resource dependency/],
  ['unapproved UI importer',f=>f.write('packages/engine/src/uiProbe.ts',"import type {UiLayoutNode} from '@egret/runtime/ui';\n"),/unapproved named resource dependency/],
  ['UI private deep package',f=>f.write('packages/engine/src/uiProbe.ts',"import '@egret/runtime/ui/managedState';\n"),/unapproved\/deep package import/],
  ['eager runtime UI logic',f=>f.write('packages/runtime/src/uiProbe.ts',"import type {UiLayoutTree} from './ui/types.js';\n"),/M3.1: root runtime acquired optional UI logic/],
  ['eager engine UI logic',f=>f.write('packages/engine/src/uiProbe.ts',"import type {UiRoot} from './ui/types.js';\n"),/M3.1: root engine acquired optional UI logic/],
  ['foreign private UI factory importer',f=>f.write('packages/engine/src/uiProbe.ts',"import {requireUiEngine} from './internal/uiFactoryState.js';\n"),/M3.1: private UI authority imported outside named modules/],
  ['duplicate contracts module identity',f=>f.write('node_modules/@egret/contracts/dist/index.js',readFileSync(path.join(f.root,'packages/contracts/dist/index.js'),'utf8')),/engine: image contract identity mismatch: IMAGE_LIMITS_2D/],
  ['range pin',f=>manifest(f,'project',pkg=>{pkg.dependencies['jsonc-parser']='^3.3.1';}),/project: external exact pin mismatch/],
  ...['constructor','toString','__proto__'].map(name=>[`inherited dependency ${name}`,f=>manifest(f,'project',pkg=>{Object.defineProperty(pkg.dependencies,name,{value:'1.0.0',enumerable:true});}),/project: dependency DAG mismatch/]),
  ...['constructor','toString','__proto__'].map(name=>[`inherited specifier ${name}`,f=>f.write('packages/project/src/json-foundation.ts',`import '${name}';\n`),new RegExp(`unapproved/deep package import ${name}`)]),
  ['deep parser import',f=>f.write('packages/project/src/json-foundation.ts',"import 'jsonc-parser/lib/umd/main.js';\n"),/unapproved\/deep package import jsonc-parser\/lib\/umd\/main.js/],
  ['runtime edge',f=>manifest(f,'project',pkg=>{pkg.dependencies['@egret/runtime']='workspace:*';}),/project: dependency DAG mismatch/],
  ['engine edge',f=>manifest(f,'project',pkg=>{pkg.dependencies['@egret/engine']='workspace:*';}),/project: dependency DAG mismatch/],
  ['reverse edge',f=>manifest(f,'runtime',pkg=>{pkg.dependencies['@egret/project']='workspace:*';}),/runtime: dependency DAG mismatch/],
  ['undeclared runtime import',f=>f.write('packages/project/src/probe.ts',"import '@egret/runtime';\n"),/unapproved\/deep package import @egret\/runtime/],
  ['reverse root reexport',f=>f.write('packages/runtime/src/probe.ts',"export {createProjectStore} from '@egret/project';\n"),/unapproved\/deep package import @egret\/project/],
  ['relative package escape',f=>f.write('packages/project/src/probe.ts',"export * from '../../runtime/src/index.js';\n"),/crosses package by relative path/],
  ['extra reference',f=>f.edit('packages/project/tsconfig.json',raw=>{const config=JSON.parse(raw);config.references.push({path:'../runtime'});return JSON.stringify(config);}),/project: project references mismatch/],
  ['external reference',f=>f.edit('packages/project/tsconfig.json',raw=>{const config=JSON.parse(raw);config.references.push({path:'../../node_modules/jsonc-parser'});return JSON.stringify(config);}),/project: project references mismatch/],
  ['DOM compiler override',f=>f.edit('packages/project/tsconfig.json',raw=>{const config=JSON.parse(raw);config.compilerOptions.lib=['ES2022','DOM'];return JSON.stringify(config);}),/project: strict compilation boundary mismatch/],
  ['Node compiler override',f=>f.edit('packages/project/tsconfig.json',raw=>{const config=JSON.parse(raw);config.compilerOptions.types=['node'];return JSON.stringify(config);}),/project: strict compilation boundary mismatch/],
  ['deep export mapping',f=>manifest(f,'project',pkg=>{pkg.exports['./private']='./dist/api.js';}),/project: root export mapping mismatch/],
  ['wrong built root mapping',f=>manifest(f,'project',pkg=>{pkg.exports['.'].import='./dist/api.js';}),/project: root export mapping mismatch/],
  ['extra runtime export',f=>f.edit('packages/project/dist/index.js',raw=>raw+'\nexport const privateLeak=1;\n'),/project: runtime export surface mismatch/],
  ['extra type export',f=>f.edit('packages/project/dist/index.d.ts',raw=>raw+'\nexport type {Prepared} from "./internal.js";\n'),/project: type-only export surface mismatch/],
  ['DOM declaration',f=>f.write('packages/project/dist/probe.d.ts','export declare const host: HTMLElement;\n'),/host ambient dependency/],
  ['Node declaration',f=>f.write('packages/project/dist/probe.d.ts','export declare const host: NodeJS.Timeout;\n'),/host ambient dependency/],
  ['DOM triple-slash declaration',f=>f.write('packages/project/dist/probe.d.ts','/// <reference lib="dom" />\nexport {};\n'),/host ambient dependency/],
  ['Node triple-slash declaration',f=>f.write('packages/project/dist/probe.d.ts','/// <reference types="node" />\nexport {};\n'),/host ambient dependency/],
];
for(const [name,change,reason]of mutations) test(`isolated actual package mutation rejects ${name} for its assigned reason`,t=>isolated(fixture=>{
  change(fixture);const result=fixture.check();assert.ifError(result.error);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,reason);
  t.diagnostic(`${name}: exit ${result.status}; ${result.stderr.match(/^Error: .+/m)?.[0]}`);
}));

test('strict public project consumers and unsuppressed diagnostic locations run through the actual type gate',()=>isolated(fixture=>{
  prepareTypeFixture(fixture);
  const result=run(['tools/check-types.mjs'],fixture.root);assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Project type fixtures PASS: 29 type-only exports/);
  // The gate ends with the retained replays. The replays bound to recorded product bytes are
  // evidence; their consumers are compiled by check-type-lanes and are not replayed here.
  assert.match(result.stdout,/SpriteSheet types PASS/);
  assert.match(result.stdout,/Shared WebGL2 strict negative PASS/);
  assert.match(result.stdout,/Resource recovery types PASS/);
  assert.doesNotMatch(result.stdout,/Sequence playback types PASS|Sequence RESET strict PASS/);
  // No byte of an emitted declaration decides this gate, and no position inside one. Give every
  // declaration of the four packages one more first line and one more last line: each of its
  // lines moves, its bytes and hash change, and what a consumer may write does not.
  let moved=0;
  const shift=directory=>{for(const entry of readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())shift(file);
    else if(entry.name.endsWith('.d.ts')){writeFileSync(file,'// moved by one line\n'+readFileSync(file,'utf8')+'\n// one more last line\n');moved++;}
  }};
  for(const name of ['contracts','runtime','engine','project'])shift(path.join(fixture.root,'packages',name,'dist'));
  assert.ok(moved>300,'every emitted declaration was rewritten: '+moved);
  const again=run(['tools/check-types.mjs'],fixture.root);assert.ifError(again.error);assert.equal(again.status,0,again.stdout+again.stderr);
  for(const line of [/Project type fixtures PASS: 29 type-only exports/,/SpriteSheet types PASS/,/Shared WebGL2 strict negative PASS/,/Resource recovery types PASS/])assert.match(again.stdout,line);
}));

test('real compiler negatives with unchanged error count reject incorrect expected code and location',t=>isolated(({root,write})=>{
  prepareTypeFixture({root});
  const original=readFileSync(path.join(root,'tests/types/project-negative.ts'),'utf8');
  for(const [name,changed,reason]of [
    ['code',original.replace('PROJECT_CASE project-entity TS2322','PROJECT_CASE project-entity TS9999'),/Project negative project-entity: missing exact line 15 \/ TS9999/],
    ['location',original.replace('PROJECT_CASE project-entity TS2322\n','PROJECT_CASE project-entity TS2322\n\n'),/Project negative project-entity: missing exact line 15 \/ TS2322/],
  ]) {
    write('tests/types/project-negative.ts',changed);
    const result=run(['tools/check-types.mjs'],root);
    assert.equal(result.status,1,`${name}: ${result.stdout}${result.stderr}`);assert.match(result.stderr,reason);
    assert.equal((result.stdout.match(/project-invalid.generated.ts\(\d+,\d+\): error TS/g)??[]).length,28);
    t.diagnostic(`${name}: 28 real compiler diagnostics; ${result.stderr.match(/^Error: Project negative .+/m)?.[0]}`);
    assert.equal(existsSync(path.join(root,'tests/types/project-invalid.generated.ts')),false);
    assert.equal(existsSync(path.join(root,'tests/types/project-invalid.generated.json')),false);
  }
  write('tests/types/project-negative.ts',original);
}));

// M1.5 total-gate registration controls: independent literal schedule, genuine
// compiler baselines, one assigned refusal, and an exact restored baseline.
const m15StrictExpectedStdout=[
  'Resource recovery strict resources-group positive PASS: 0 actual diagnostics.',
  'Resource recovery strict resources-group negative PASS: 11 actual diagnostics.',
  'Resource recovery strict manifest-browser positive PASS: 0 actual diagnostics.',
  'Resource recovery strict manifest-browser negative PASS: 17 actual diagnostics.',
  'Resource recovery strict candidate-shared-frame positive PASS: 0 actual diagnostics.',
  'Resource recovery strict candidate-shared-frame negative PASS: 14 actual diagnostics.',
  'Resource recovery strict manifest-resource-diagnostics positive PASS: 0 actual diagnostics.',
  'Resource recovery strict manifest-resource-diagnostics negative PASS: 16 actual diagnostics.',
  'Resource recovery strict shared-frame-upload-gpu positive PASS: 0 actual diagnostics.',
  'Resource recovery strict shared-frame-upload-gpu negative PASS: 17 actual diagnostics.',
  'Resource recovery strict shared-frame-upload-webgl2 positive PASS: 0 actual diagnostics.',
  'Resource recovery strict shared-frame-upload-webgl2 negative PASS: 24 actual diagnostics.',
  'Resource recovery strict shared-host-resource-diagnostics positive PASS: 0 actual diagnostics.',
  'Resource recovery strict shared-host-resource-diagnostics negative PASS: 13 actual diagnostics.',
  'Resource recovery types PASS: seven public consumer pairs, 112 exact unsuppressed refusals; runtime/native acceptance is separate.',
].join('\n')+'\n';
const m15StrictHealthy=result=>{
  assert.ifError(result.error);
  assert.equal(result.signal,null);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(result.stderr,'');
  assert.equal(result.stdout.replaceAll('\r\n','\n'),m15StrictExpectedStdout);
};
for(const control of [
  {
    name:'consumer-byte identity',
    file:'tests/types/resources-group-negative.ts',
    mutate:original=>original.toString('utf8')+'\n// assigned strict input drift\n',
    reason:/^AssertionError \[ERR_ASSERTION\]: M1\.5 strict input changed: tests\/types\/resources-group-negative\.ts$/m,
    stdout:'',
  },
  {
    name:'same-count wrong diagnostic code',
    file:'tests/types/resource-recovery-3-diagnostic-expectations.json',
    mutate:original=>{
      const value=JSON.parse(original.toString('utf8'));
      assert.equal(value.pairs[0].pair,'resources-group');
      assert.equal(value.pairs[0].tuples.length,11);
      assert.equal(value.pairs[0].tuples[0][3],2375);
      value.pairs[0].tuples[0][3]=9999;
      assert.equal(value.pairs[0].tuples.length,11);
      return JSON.stringify(value,null,2)+'\n';
    },
    reason:/^AssertionError \[ERR_ASSERTION\]: M1\.5 exact diagnostic tuples mismatch: resources-group negative$/m,
    // The original positive compiler must complete before the actual negative
    // compiler reports a tuple that differs from the one altered expectation.
    stdout:'Resource recovery strict resources-group positive PASS: 0 actual diagnostics.\n',
  },
  {
    name:'missing diagnostic tuple',
    file:'tests/types/resource-recovery-3-diagnostic-expectations.json',
    mutate:original=>{
      const value=JSON.parse(original.toString('utf8'));
      assert.equal(value.pairs[0].pair,'resources-group');
      assert.equal(value.pairs[0].tuples.length,11);
      assert.deepEqual(value.pairs[0].tuples.pop(),['tests/types/resources-group-negative.ts',23,7,2741]);
      assert.equal(value.pairs[0].tuples.length,10);
      return JSON.stringify(value,null,2)+'\n';
    },
    reason:/^AssertionError \[ERR_ASSERTION\]: M1\.5 diagnostic tuple count mismatch: resources-group$/m,
    stdout:'',
  },
]) test('M1.5 seven-pair strict gate rejects '+control.name+' between complete genuine baselines',()=>isolated(fixture=>{
  prepareTypeFixture(fixture);
  const args=['tools/resource-recovery-types.mjs'];
  m15StrictHealthy(run(args,fixture.root));
  const original=readFileSync(path.join(fixture.root,control.file));
  let refused;
  try{
    fixture.write(control.file,control.mutate(original));
    refused=run(args,fixture.root);
  }finally{
    fixture.write(control.file,original.toString('utf8'));
    assert.deepEqual(readFileSync(path.join(fixture.root,control.file)),original);
    // Restoration is executed even if mutation or process invocation throws.
    m15StrictHealthy(run(args,fixture.root));
  }
  assert.ifError(refused.error);
  assert.equal(refused.signal,null);
  assert.equal(refused.status,1,refused.stdout+refused.stderr);
  assert.match(refused.stderr,control.reason);
  assert.doesNotMatch(refused.stderr,/ERR_MODULE_NOT_FOUND|SyntaxError/);
  assert.equal(refused.stdout.replaceAll('\r\n','\n'),control.stdout);
  assert.doesNotMatch(refused.stdout,/Resource recovery types PASS/);
}));
