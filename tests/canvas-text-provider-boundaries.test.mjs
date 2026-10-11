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
// First-party actual-copy scaffold from tests/text-field-boundaries.test.mjs
// (through textured-webgpu-types and project-boundaries). Each case starts with a genuine
// valid copied graph and the exact production checker; no text authority shim.
function isolated(action){
  mkdirSync(parent,{recursive:true});const fixture=mkdtempSync(path.join(parent,'canvas-text-boundary-'));
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
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('canvas-text-boundary-'));
    for(const name of ['contracts','runtime','engine','project']){
      const link=path.join(resolved,'node_modules/@egret',name);
      if(existsSync(link))assert.equal(realpathSync(link),realpathSync(path.join(resolved,'packages',name)),'junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved,{recursive:true,force:true});assert.equal(existsSync(resolved),false);
  }
}
test('WC01 actual four-package Canvas text baseline passes production policy',t=>isolated(f=>{
  checked(f.check(),0);t.diagnostic('Genuine compiled package baseline; checker '+f.checkerHash);
}));
const canvasTextMutations=[
  ['root-factory','packages/engine/dist/index.js',raw=>raw+"\nexport {createCanvasTextRasterProvider} from './web/CanvasTextRasterProvider.js';\n",'Canvas text opt-in module imported outside its barrel'],
  ['web-factory','packages/engine/dist/web/index.js',raw=>raw+"\nexport {createCanvasTextRasterProvider} from './CanvasTextRasterProvider.js';\n",'Canvas text opt-in module imported outside its barrel'],
  ['web-hidden-value-import','packages/engine/web/index.ts',raw=>raw+"\nimport './CanvasTextRasterProvider.js';\n",'Canvas text opt-in module imported outside its barrel'],
  ['dom-in-core','packages/engine/src/index.ts',raw=>raw+'\nexport const wc1DomLeak = document;\n','packages/engine/src/index.ts: host ambient dependency'],
  ['private-text-value','packages/engine/web/CanvasTextRasterProvider.ts',raw=>raw+"\nimport {createTextRasterCache} from '@egret/runtime/text';\n",'unapproved/deep package import @egret/runtime/text'],
  ['public-text-value','packages/engine/web/CanvasTextRasterProvider.ts',raw=>raw+"\nimport {createTextRasterCache} from '@egret/engine/text';\n",'unapproved/deep package import @egret/engine/text'],
  ['wrong-nested-mapping','packages/engine/package.json',raw=>{
    const pkg=JSON.parse(raw);pkg.exports['./web/text'].import='./dist/web/index.js';return JSON.stringify(pkg,null,2)+'\n';
  },'engine: text explicit export mapping mismatch'],
  ['declaration-extra-port','packages/engine/dist/web/text.d.ts',raw=>raw+'\nexport interface CanvasTextRasterProviderOptions {}\n','web/text: exact Canvas text declaration surface mismatch'],
];
for(const [name,file,change,reason] of canvasTextMutations)test('WC01 actual baseline then '+name+' assigned refusal',()=>isolated(f=>{
  checked(f.check(),0);f.edit(file,change);
  // The production scanner prints native relative separators. Normalize only
  // that path spelling; do not weaken the expected exit or assigned reason.
  const result=f.check();checked({...result,stderr:result.stderr.replaceAll('\\','/')},1,reason);
}));
