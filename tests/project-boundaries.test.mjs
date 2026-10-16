import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,symlinkSync,rmSync,realpathSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ownerRelativePath,samePhysicalPath} from '../tools/lib/file-identity.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const parent=path.join(repository,'work');
const values=['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
const types=['ProjectId','EntityId','FileId','TransactionId','ProjectRevision','Sha256','JsonValue','JsonObject','ProjectVersionPins','ProjectReference','ProjectEntity','ProjectFileRole','ProjectFile','ProjectSnapshot','ProjectTransactionSource','ProjectTransactionScope','ProjectOperation','ProjectEditTransaction','ProjectRestoreTransaction','ProjectTransaction','ProjectHistory','ProjectDiff','ProjectDiagnosticCode','ProjectDiagnostic','ProjectValueResult','ProjectTransactionReceipt','ProjectCommitResult','ProjectLimits','ProjectStore'];
const run=(args,cwd=repository)=>spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});

// Every fixture copies actual packages/dependencies; an owned junction shares the runtime singleton.
// The separate contracts resolution copy retains its explicit root bridge and duplicate-identity control.
// Package/dist mutations still reach the same resolution inputs.
function isolated(action) {
  mkdirSync(parent,{recursive:true});
  const root=mkdtempSync(path.join(parent,'project-boundary-'));
  const write=(relative,content)=>{
    const file=path.join(root,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,typeof content==='string'?content:JSON.stringify(content));
    const mirrored=relative.match(/^packages\/(contracts|runtime|engine|project)\/(package.json|dist\/.*)$/);
    if(mirrored) {const target=path.join(root,'node_modules/@egret',mirrored[1],mirrored[2]);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,readFileSync(file));}
  };
  const edit=(relative,change)=>{const file=path.join(root,relative);write(relative,change(readFileSync(file,'utf8')));};
  try {
    for(const name of ['contracts','runtime','engine','project']) {
      for(const entry of ['package.json','tsconfig.json','src','dist',...(name==='engine'?['web','rendering','tsconfig.web.json','tsconfig.rendering.json']:[])]) cpSync(path.join(repository,'packages',name,entry),path.join(root,'packages',name,entry),{recursive:true});
      mkdirSync(path.join(root,'node_modules/@egret'),{recursive:true});
      if(name==='runtime') {
        const runtimeRoot=path.join(root,'packages',name),runtimeLink=path.join(root,'node_modules/@egret',name);
        symlinkSync(runtimeRoot,runtimeLink,'junction');
        assert.equal(realpathSync(runtimeLink),realpathSync(runtimeRoot));
      } else cpSync(path.join(root,'packages',name),path.join(root,'node_modules/@egret',name),{recursive:true});
    }
    for(const name of ['jsonc-parser','robust-predicates']) {
      const require=createRequire(path.join(repository,'packages',name==='jsonc-parser'?'project':'engine','package.json'));
      const entry=realpathSync(require.resolve(name));
      const installed=name==='jsonc-parser'?path.resolve(path.dirname(entry),'../..'):path.dirname(entry);
      cpSync(installed,path.join(root,'node_modules',name),{recursive:true});
    }
    // Preserve the actual contracts root bytes in packages; only its resolution copy is a bridge.
    const contractsRoot = readFileSync(path.join(root,'packages/contracts/dist/index.js'));
    assert.deepEqual(readFileSync(path.join(root,'node_modules/@egret/contracts/dist/index.js')), contractsRoot);
    write('node_modules/@egret/contracts/dist/index.js', "export * from '../../../../packages/contracts/dist/index.js';\n");
    assert.deepEqual(readFileSync(path.join(root,'packages/contracts/dist/index.js')), contractsRoot);
    // The explicit scene facade must share the original geometry/scene registries.
    // Bridge only the resolution copy; source and emitted package bytes stay real.
    for(const name of ['matrix4','meshGeometry3D','sceneFrame3D']) {
      const relative='packages/engine/dist/rendering/'+name+'.js';
      const actual=readFileSync(path.join(root,relative));
      const resolution='node_modules/@egret/engine/dist/rendering/'+name+'.js';
      assert.deepEqual(readFileSync(path.join(root,resolution)),actual);
      write(resolution,"export * from '../../../../../"+relative+"';\n");
      assert.deepEqual(readFileSync(path.join(root,relative)),actual);
    }
    write('tools/check-boundaries.mjs',readFileSync(path.join(repository,'tools/check-boundaries.mjs'),'utf8'));
    return action({root,write,edit,check:()=>run(['tools/check-boundaries.mjs'],root)});
  } finally {
    const resolved=realpathSync(root);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('project-boundary-'));
    const runtimeLink=path.join(resolved,'node_modules/@egret/runtime');
    if(existsSync(runtimeLink)) assert.equal(realpathSync(runtimeLink),realpathSync(path.join(resolved,'packages/runtime')),'runtime junction stays in the owned copied graph');
    rmSync(resolved,{recursive:true,force:true});
    assert.equal(existsSync(resolved),false);
  }
}

// A successful whole gate also reaches the retained native compiler/type owners.
// Copy those real inputs; all generated sources/configurations stay inside this fixture.
function prepareTypeFixture({root}) {
  const copy=relative=>{
    const target=path.join(root,relative);
    ownerRelativePath(root,target);
    mkdirSync(path.dirname(target),{recursive:true});
    cpSync(path.join(repository,relative),target,{recursive:true});
  };
  copy('tests/types');
  for(const relative of [
    'packages/engine/tests/geometry-contract-types.ts',
    'packages/engine/tests/profile-contract-types.ts',
    'package.json','pnpm-lock.yaml','tsconfig.base.json',
    'tools/check-types.mjs','tools/sequence-playback-types.mjs',
    'tools/spritesheet-types.mjs','tools/nine-slice-bitmap-types.mjs','tools/display-container-remove-children-types.mjs','tools/display-container-child-index-types.mjs','tools/display-container-add-child-at-types.mjs','tools/display-anchor-offsets-types.mjs','tools/bitmap-button-types.mjs','tools/linear-layout-types.mjs','tools/lib/file-identity.mjs',
  ]) copy(relative);

  // Read-only stock compiler inputs are copied, never mocked or linked outside the owner.
  const compilerOwner=realpathSync(path.join(repository,'node_modules/typescript'));
  const compilerMetadata=JSON.parse(readFileSync(path.join(compilerOwner,'package.json'),'utf8'));
  assert.equal(compilerMetadata.name,'typescript');
  assert.equal(compilerMetadata.version,'7.0.2');
  const nativeName='@typescript/typescript-'+process.platform+'-'+process.arch;
  const nativeOwner=path.dirname(realpathSync(createRequire(path.join(compilerOwner,'package.json')).resolve(nativeName+'/package.json')));
  const nativeMetadata=JSON.parse(readFileSync(path.join(nativeOwner,'package.json'),'utf8'));
  assert.equal(nativeMetadata.name,nativeName);
  assert.equal(nativeMetadata.version,compilerMetadata.version);
  const compilerTarget=path.join(root,'node_modules/typescript');
  const nativeTarget=path.join(root,'node_modules',nativeName);
  ownerRelativePath(root,compilerTarget);ownerRelativePath(root,nativeTarget);
  mkdirSync(path.dirname(nativeTarget),{recursive:true});
  cpSync(compilerOwner,compilerTarget,{recursive:true});
  cpSync(nativeOwner,nativeTarget,{recursive:true});
  assert.deepEqual(readFileSync(path.join(compilerTarget,'package.json')),readFileSync(path.join(compilerOwner,'package.json')));
  assert.deepEqual(readFileSync(path.join(nativeTarget,'package.json')),readFileSync(path.join(nativeOwner,'package.json')));

  // Type gates qualify physical public aliases against the four genuine copied packages.
  // Runtime boundary controls above retain their distinct resolution copies and bridges.
  for(const name of ['contracts','runtime','engine','project']) {
    const alias=path.join(root,'node_modules/@egret',name),target=path.join(root,'packages',name);
    if(!samePhysicalPath(realpathSync(alias),realpathSync(target))) {
      assert.equal(ownerRelativePath(realpathSync(root),realpathSync(alias)),'node_modules/@egret/'+name);
      rmSync(alias,{recursive:true,force:false});
      symlinkSync(target,alias,'junction');
    }
    assert.equal(ownerRelativePath(realpathSync(root),realpathSync(alias)),'packages/'+name);
    assert.equal(samePhysicalPath(realpathSync(alias),realpathSync(target)),true);
  }
  assert.deepEqual(readFileSync(path.join(root,'tools/check-types.mjs')),readFileSync(path.join(repository,'tools/check-types.mjs')));
}

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

const manifest=(fixture,name,mutate)=>fixture.edit(`packages/${name}/package.json`,raw=>{const pkg=JSON.parse(raw);mutate(pkg);return JSON.stringify(pkg);});
const mutations=[
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
  assert.match(result.stdout,/Sequence playback types PASS/);
  assert.match(result.stdout,/SpriteSheet types PASS/);
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
