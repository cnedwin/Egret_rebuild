import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,cpSync,symlinkSync,rmSync,realpathSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository=fileURLToPath(new URL('..',import.meta.url)),parent=path.join(repository,'work');
const checked=(result,status,reason)=>{
  assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.status,status,result.stdout+result.stderr);
  if(reason)assert.ok(result.stderr.includes(reason),result.stderr);else assert.match(result.stdout,/Boundary check PASS/);
};
// First-party actual-copy scaffold from tests/textured-webgpu-types.test.mjs
// (itself attributed to project-boundaries). Every mutation follows a genuine
// valid copied graph and the exact production checker; no text authority shim.
function isolated(action){
  mkdirSync(parent,{recursive:true});const fixture=mkdtempSync(path.join(parent,'text-raster-boundary-'));
  const checker=readFileSync(path.join(repository,'tools/check-boundaries.mjs'));
  const checkerHash=createHash('sha256').update(checker).digest('hex');
  const write=(relative,content)=>{const file=path.join(fixture,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,content);};
  const edit=(relative,change)=>write(relative,change(readFileSync(path.join(fixture,relative),'utf8')));
  try{
    for(const name of ['contracts','runtime','engine','project']){
      for(const entry of ['package.json','tsconfig.json','src','dist',...(name==='engine'?['web','rendering','tsconfig.web.json','tsconfig.rendering.json']:[])])
        cpSync(path.join(repository,'packages',name,entry),path.join(fixture,'packages',name,entry),{recursive:true});
      mkdirSync(path.join(fixture,'node_modules/@egret'),{recursive:true});
      const packageRoot=path.join(fixture,'packages',name),link=path.join(fixture,'node_modules/@egret',name);
      symlinkSync(packageRoot,link,'junction');assert.equal(realpathSync(link),realpathSync(packageRoot));
    }
    for(const name of ['jsonc-parser','robust-predicates']){
      const require=createRequire(path.join(repository,'packages',name==='jsonc-parser'?'project':'engine','package.json'));
      const entry=realpathSync(require.resolve(name));const installed=name==='jsonc-parser'?path.resolve(path.dirname(entry),'../..'):path.dirname(entry);
      cpSync(installed,path.join(fixture,'node_modules',name),{recursive:true});
    }
    write('tools/check-boundaries.mjs',checker);
    assert.equal(createHash('sha256').update(readFileSync(path.join(fixture,'tools/check-boundaries.mjs'))).digest('hex'),checkerHash);
    const check=()=>spawnSync(process.execPath,['tools/check-boundaries.mjs'],{cwd:fixture,encoding:'utf8',maxBuffer:8*1024*1024});
    return action({fixture,write,edit,check,checkerHash});
  }finally{
    const resolved=realpathSync(fixture);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('text-raster-boundary-'));
    for(const name of ['contracts','runtime','engine','project']){
      const link=path.join(resolved,'node_modules/@egret',name);
      if(existsSync(link))assert.equal(realpathSync(link),realpathSync(path.join(resolved,'packages',name)),'junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved,{recursive:true,force:true});assert.equal(existsSync(resolved),false);
  }
}
test('T02 actual text entries share the cache factory and preserve default entry isolation',async()=>{
  const runtime=await import('@egret/runtime/text'),engine=await import('@egret/engine/text');
  assert.deepEqual(Object.keys(runtime),['createTextRasterCache']);assert.deepEqual(Object.keys(engine),['createTextField','createTextRasterCache']);
  assert.equal(typeof runtime.createTextRasterCache,'function');assert.equal(runtime.createTextRasterCache,engine.createTextRasterCache);
  for(const specifier of ['@egret/runtime','@egret/engine','@egret/engine/web','@egret/engine/webgpu'])
    assert.equal(Object.hasOwn(await import(specifier),'createTextRasterCache'),false,specifier);
});
test('T02 valid actual four-package graph with exact text routes passes the production checker',t=>isolated(f=>{
  checked(f.check(),0);t.diagnostic(`Owned four-package junction graph; exact production checker ${f.checkerHash}; no compiler or font/native execution.`);
}));
const mutations=[
  ['manager-authority','packages/engine/dist/index.d.ts',raw=>raw+'\nexport declare function requireAssetManagerOwner(value: unknown): object;\n','root: private text authority leaked: requireAssetManagerOwner'],
  ['lease-retirement','packages/runtime/dist/text/index.d.ts',raw=>raw+'\nexport declare function observeAssetLeaseRetirement(value: unknown, retired: () => void): boolean;\n','runtime/text: private text authority leaked: observeAssetLeaseRetirement'],
  ['issuer-type','packages/engine/dist/text.d.ts',raw=>raw+'\nexport interface TextRasterPlanIssuer {}\n','engine/text: private text authority leaked: TextRasterPlanIssuer'],
  ['real-budget-alias','packages/runtime/dist/index.d.ts',raw=>raw+"\nexport type {TextBudget as EscapedBudget} from './text/budget.js';\n",'runtime: private text authority leaked: TextBudget'],
  ['aliased-plan-module','packages/runtime/dist/text/index.d.ts',raw=>raw+"\nexport type * as EscapedPlan from './plan.js';\n",'runtime/text: private text module leaked'],
  ['default-root-text-type','packages/engine/dist/index.d.ts',raw=>raw+'\nexport interface TextRasterRequestInput {}\n','root: explicit-only text port leaked: TextRasterRequestInput'],
  ['default-runtime-text-module','packages/runtime/dist/index.d.ts',raw=>raw+"\nexport type * from './text/index.js';\n",'runtime: explicit-only text module leaked'],
  ['extra-runtime-package-route','packages/runtime/package.json',raw=>{const p=JSON.parse(raw);p.exports['./text/plan']={types:'./dist/text/plan.d.ts',import:'./dist/text/plan.js'};return JSON.stringify(p);},'runtime: text explicit export mapping mismatch'],
  ['wrong-engine-text-route','packages/engine/package.json',raw=>{const p=JSON.parse(raw);p.exports['./text'].import='./dist/web/index.js';return JSON.stringify(p);},'engine: text explicit export mapping mismatch'],
  ['wrong-parent-runtime-text-import','packages/engine/src/Engine.ts',raw=>raw+"\nimport type {TextRasterRequest} from '@egret/runtime/text';\n",'unapproved/deep package import @egret/runtime/text'],
  ['unsupported-runtime-text-prefix','packages/engine/src/text.ts',raw=>raw+"\nimport type {TextRasterPlan} from '@egret/runtime/text/plan';\n",'unapproved/deep package import @egret/runtime/text/plan'],
  ['core-DOM-ambient','packages/runtime/dist/text/types.d.ts',raw=>raw+'\nexport interface InvalidDOMPort { surface: HTMLCanvasElement; }\n','host ambient dependency'],
  ['core-DOM-reference','packages/runtime/src/text/types.ts',raw=>raw+'\n/// <reference lib="dom" />\n','host ambient dependency'],
  ['extra-text-declaration-alias','packages/runtime/dist/text/index.d.ts',raw=>raw+"\nexport type {TextRasterCache as EscapedCache} from './types.js';\n",'runtime/text: exact text declaration surface mismatch'],
  ['brand-emitted-value','packages/runtime/dist/text/types.js',raw=>raw+'\nexport const requestBrand = Symbol();\n','runtime/text: canonical types emitted runtime values'],
  ['manager-authority-executable','packages/runtime/dist/index.js',raw=>raw+"\nexport {requireAssetManagerOwner} from './assetManagerOwnerState.js';\n",'runtime: private text authority leaked: requireAssetManagerOwner'],
  ['lease-retirement-executable','packages/runtime/dist/text/index.js',raw=>raw+"\nexport {observeAssetLeaseRetirement} from '../AssetLease.js';\n",'runtime/text: private text authority leaked: observeAssetLeaseRetirement'],
];
for(const [name,file,change,reason]of mutations)test(`T02 ${name} refuses its assigned reason after a valid actual graph`,()=>isolated(f=>{
  checked(f.check(),0);f.edit(file,change);checked(f.check(),1,reason);
}));
