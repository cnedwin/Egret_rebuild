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
// First-party actual-copy scaffold from tests/text-raster-boundaries.test.mjs,
// with its project/textured-webgpu provenance retained. These controls execute
// the unchanged production checker against genuine current four-package builds.
function isolated(action){
  mkdirSync(parent,{recursive:true});const fixture=mkdtempSync(path.join(parent,'game-clock-boundary-'));
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
    return action({fixture,edit,check,checkerHash});
  }finally{
    const resolved=realpathSync(fixture);
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('game-clock-boundary-'));
    for(const name of ['contracts','runtime','engine','project']){
      const link=path.join(resolved,'node_modules/@egret',name);
      if(existsSync(link))assert.equal(realpathSync(link),realpathSync(path.join(resolved,'packages',name)),'junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved,{recursive:true,force:true});assert.equal(existsSync(resolved),false);
  }
}

test('GC18 actual public roots have no executable clock factories/types/brands',async()=>{
  // Contracts has no repository consumer alias; use its actual built public root,
  // as the production checker does, without granting any private module import.
  for(const specifier of ['../packages/contracts/dist/index.js','@egret/runtime','@egret/engine','@egret/engine/web','@egret/engine/webgpu','@egret/engine/text','@egret/runtime/text','@egret/project']){
    const values=await import(specifier);
    for(const name of ['GameClockOptions','GameClockState','GameClockTick','GameClockHandler','GameClock','GameClockSubscription','admitGameClockOptions','createGameClockOwner','AdmittedGameClockOptions','GameClockContext','GameClockOwner','clockBrand','subscriptionBrand','createGameClock']) assert.equal(Object.hasOwn(values,name),false,specifier+': '+name);
  }
});
test('GC18 genuine four-package baseline passes the exact production checker',t=>isolated(f=>{
  checked(f.check(),0);t.diagnostic(`Owned four-package junction graph; production checker ${f.checkerHash}; source/emission controls, no private behavior import.`);
}));
// Meaningful selected controls, each with a genuine green graph before mutation.
const mutations=[
  ['admission-helper','packages/engine/dist/index.d.ts',raw=>raw+"\nexport {admitGameClockOptions} from './gameClock.js';\n",'root: private clock authority leaked: admitGameClockOptions'],
  ['owner-helper','packages/engine/dist/text.d.ts',raw=>raw+"\nexport {createGameClockOwner} from './gameClock.js';\n",'engine/text: private clock authority leaked: createGameClockOwner'],
  ['admitted-options','packages/contracts/dist/index.d.ts',raw=>raw+'\nexport interface AdmittedGameClockOptions {}\n','contracts: private clock authority leaked: AdmittedGameClockOptions'],
  ['owner-context','packages/engine/dist/web/index.d.ts',raw=>raw+'\nexport interface GameClockContext {}\n','web: private clock authority leaked: GameClockContext'],
  ['owner-type','packages/runtime/dist/index.d.ts',raw=>raw+'\nexport interface GameClockOwner {}\n','runtime: private clock authority leaked: GameClockOwner'],
  ['aliased-private-module','packages/engine/dist/index.d.ts',raw=>raw+"\nexport type * as EscapedClock from './gameClock.js';\n",'root: private clock module leaked'],
  ['clock-brand-facade','packages/engine/dist/index.d.ts',raw=>raw+'\nexport declare const clockBrand: unique symbol;\n','root: private clock authority leaked: clockBrand'],
  ['subscription-brand-facade','packages/runtime/dist/text/index.d.ts',raw=>raw+'\nexport declare const subscriptionBrand: unique symbol;\n','runtime/text: private clock authority leaked: subscriptionBrand'],
  ['erased-brand-emission','packages/engine/dist/gameClockTypes.js',raw=>raw+'\nexport const clockBrand = Symbol();\n','engine: clock types emitted runtime values'],
  ['missing-root-type','packages/engine/dist/index.d.ts',raw=>raw.replace('GameClockOptions, ','') ,'root: exact clock type-only export surface mismatch'],
  ['extra-canonical-type','packages/engine/dist/gameClockTypes.d.ts',raw=>raw+'\nexport interface ClockOwnerPort {}\n','engine: canonical clock type inventory mismatch'],
  ['wrong-runtime-entry','packages/runtime/dist/index.d.ts',raw=>raw+'\nexport interface GameClock {}\n','runtime: Engine-only clock type leaked: GameClock'],
  ['automatic-source-time','packages/engine/src/gameClock.ts',raw=>raw+'\nconst forbiddenClockSample = Date.now();\n','packages/engine/src/gameClock.ts: clock automatic timing dependency'],
  ['automatic-emitted-timer','packages/engine/dist/gameClock.js',raw=>raw+'\nsetTimeout(() => {}, 1);\n','packages/engine/dist/gameClock.js: clock automatic timing dependency'],
  ['clock-DOM-reference','packages/engine/src/gameClockTypes.ts',raw=>raw+'\n/// <reference lib="dom" />\n','packages/engine/src/gameClockTypes.ts: host ambient dependency'],
  ['new-clock-subpath','packages/engine/package.json',raw=>{const p=JSON.parse(raw);p.exports['./gameClock']={types:'./dist/gameClock.d.ts',import:'./dist/gameClock.js'};return JSON.stringify(p);},'engine: text explicit export mapping mismatch'],
];
for(const [name,file,change,reason]of mutations)test(`GC18 ${name} refuses its assigned reason after a valid actual graph`,()=>isolated(f=>{
  checked(f.check(),0);f.edit(file,change);checked(f.check(),1,reason);
}));
