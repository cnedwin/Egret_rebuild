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
// First-party actual-copy scaffold from tests/text-raster-boundaries.test.mjs
// (through textured-webgpu-types and project-boundaries). Each case starts with a genuine
// valid copied graph and the exact production checker; no text authority shim.
function isolated(action){
  mkdirSync(parent,{recursive:true});const fixture=mkdtempSync(path.join(parent,'text-field-boundary-'));
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
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('text-field-boundary-'));
    for(const name of ['contracts','runtime','engine','project']){
      const link=path.join(resolved,'node_modules/@egret',name);
      if(existsSync(link))assert.equal(realpathSync(link),realpathSync(path.join(resolved,'packages',name)),'junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved,{recursive:true,force:true});assert.equal(existsSync(resolved),false);
  }
}
test('TF08 actual four-package TextField baseline passes unchanged production policy',t=>isolated(f=>{
  checked(f.check(),0);t.diagnostic('Genuine compiled package baseline; checker '+f.checkerHash);
}));
const fieldMutations=[
  ['default-factory','packages/engine/dist/index.js',raw=>raw+"\nexport {createTextField} from './textField.js';\n",'root: executable textured-frame export surface mismatch'],
  ['default-type','packages/engine/dist/index.d.ts',raw=>raw+'\nexport interface TextField {}\n','root: explicit-only TextField port leaked: TextField'],
  ['private-constructor','packages/engine/dist/text.d.ts',raw=>raw+'\nexport declare function createTextFieldLeaf(): object;\n','engine/text: private text authority leaked: createTextFieldLeaf'],
  ['private-registry-alias','packages/engine/dist/text.d.ts',raw=>raw+"\nexport type {TextFieldEnginePort as EscapedPort} from './internal/textFieldFactoryState.js';\n",'engine/text: private text authority leaked: TextFieldEnginePort'],
  ['private-module-alias','packages/engine/dist/text.d.ts',raw=>raw+"\nexport type * as EscapedState from './internal/textFieldFactoryState.js';\n",'engine/text: private text module leaked'],
  ['brand-value','packages/engine/dist/text.js',raw=>raw+'\nexport const textFieldBrand=Symbol();\n','engine/text: private TextField brand value leaked'],
  ['extra-value','packages/engine/dist/text.js',raw=>raw+'\nexport function extraTextFactory() {}\n','engine/text: exact text runtime surface mismatch'],
];
for(const [name,file,change,reason] of fieldMutations)test('TF08 actual baseline then '+name+' assigned refusal',()=>isolated(f=>{
  checked(f.check(),0);f.edit(file,change);checked(f.check(),1,reason);
}));
