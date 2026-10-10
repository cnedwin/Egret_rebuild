import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,rmSync,realpathSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository=fileURLToPath(new URL('..',import.meta.url));
const parent=path.join(repository,'work');
const values=['DEFAULT_PROJECT_LIMITS','createProjectStore','openProjectHistory','parseProjectSnapshot','parseProjectTransaction','serializeProjectSnapshot'];
const types=['ProjectId','EntityId','FileId','TransactionId','ProjectRevision','Sha256','JsonValue','JsonObject','ProjectVersionPins','ProjectReference','ProjectEntity','ProjectFileRole','ProjectFile','ProjectSnapshot','ProjectTransactionSource','ProjectTransactionScope','ProjectOperation','ProjectEditTransaction','ProjectRestoreTransaction','ProjectTransaction','ProjectHistory','ProjectDiff','ProjectDiagnosticCode','ProjectDiagnostic','ProjectValueResult','ProjectTransactionReceipt','ProjectCommitResult','ProjectLimits','ProjectStore'];
const run=(args,cwd=repository)=>spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});

// Every fixture copies actual packages/dependencies; one explicit contracts root bridge shares identity.
// Its Node resolution copies receive the same package/dist mutations.
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
      cpSync(path.join(root,'packages',name),path.join(root,'node_modules/@egret',name),{recursive:true});
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
    write('tools/check-boundaries.mjs',readFileSync(path.join(repository,'tools/check-boundaries.mjs'),'utf8'));
    return action({root,write,edit,check:()=>run(['tools/check-boundaries.mjs'],root)});
  } finally {
    const resolved=realpathSync(root);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('project-boundary-'));
    rmSync(resolved,{recursive:true,force:true});
    assert.equal(existsSync(resolved),false);
  }
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

test('strict public project consumers and unsuppressed diagnostic locations run through the actual type gate',()=>{
  const result=run(['tools/check-types.mjs']);assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/Project type fixtures PASS: 29 type-only exports/);
});

test('real compiler negatives with unchanged error count reject incorrect expected code and location',t=>isolated(({root,write})=>{
  cpSync(path.join(repository,'tests/types'),path.join(root,'tests/types'),{recursive:true});
  write('tsconfig.base.json',readFileSync(path.join(repository,'tsconfig.base.json'),'utf8'));
  const checker=readFileSync(path.join(repository,'tools/check-types.mjs'),'utf8');
  // The installed compiler is read-only outside the fixture; package/type inputs
  // and the expectation mutations stay in this isolated actual-copy workspace.
  write('tools/check-types.mjs',checker.replace('path.join(root, "node_modules/typescript/bin/tsc")',JSON.stringify(path.join(repository,'node_modules/typescript/bin/tsc'))));
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
