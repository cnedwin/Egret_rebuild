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
  mkdirSync(parent,{recursive:true});const fixture=mkdtempSync(path.join(parent,'tween-boundary-'));
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
    assert.ok(resolved.toLowerCase().startsWith(realpathSync(parent).toLowerCase()+path.sep)&&path.basename(resolved).startsWith('tween-boundary-'));
    for(const name of ['contracts','runtime','engine','project']){
      const link=path.join(resolved,'node_modules/@egret',name);
      if(existsSync(link))assert.equal(realpathSync(link),realpathSync(path.join(resolved,'packages',name)),'junction cleanup stays in the owned copied graph');
    }
    rmSync(resolved,{recursive:true,force:true});assert.equal(existsSync(resolved),false);
  }
}

// Adapted from the first-party game-clock source-control scaffold above.
// Source/emission controls only; these are not fake numeric-state behavior tests.
test('TW10 actual public roots have no executable Tween values factories owners or brands',async()=>{
  // Retained contracts public-root route has no repository consumer alias.
  for(const specifier of ['../packages/contracts/dist/index.js','@egret/runtime','@egret/engine','@egret/engine/web','@egret/engine/webgpu','@egret/engine/text','@egret/runtime/text','@egret/project']){
    const values=await import(specifier);
    for(const name of ['Tween','TweenState','TweenOptions','TweenEasing','createTweenOwner','TweenContext','TweenOwner','tweenBrand','createTween'])assert.equal(Object.hasOwn(values,name),false,specifier+': '+name);
  }
});
test('TW10 genuine four-package baseline passes the exact production checker',t=>isolated(f=>{
  checked(f.check(),0);t.diagnostic(`Owned four-package junction graph; production checker ${f.checkerHash}; source/emission controls, no private behavior import.`);
}));
const mutations=[
  ['owner-factory','packages/engine/dist/index.d.ts',raw=>raw+"\nexport {createTweenOwner} from './tween.js';\n",'root: private Tween authority leaked: createTweenOwner'],
  ['owner-context','packages/engine/dist/web/index.d.ts',raw=>raw+'\nexport interface TweenContext {}\n','web: private Tween authority leaked: TweenContext'],
  ['owner-type','packages/runtime/dist/index.d.ts',raw=>raw+'\nexport interface TweenOwner {}\n','runtime: private Tween authority leaked: TweenOwner'],
  ['aliased-private-module','packages/engine/dist/index.d.ts',raw=>raw+"\nexport type * as EscapedTween from './tween.js';\n",'root: private Tween module leaked'],
  ['brand-facade','packages/engine/dist/text.d.ts',raw=>raw+'\nexport declare const tweenBrand: unique symbol;\n','engine/text: exact text declaration surface mismatch'],
  ['erased-brand-emission','packages/engine/dist/tweenTypes.js',raw=>raw+'\nexport const tweenBrand = Symbol();\n','engine: Tween types emitted runtime values'],
  ['missing-root-type','packages/engine/dist/index.d.ts',raw=>{const next=raw.replace(/\bTweenOptions\s*,\s*|,\s*TweenOptions\b/,'');assert.notEqual(next,raw);return next;},'root: exact Tween type-only export surface mismatch'],
  ['extra-root-type-namespace','packages/engine/dist/index.d.ts',raw=>raw+"\nexport type * as ExtraTweenTypes from './tweenTypes.js';\n",'root: exact Tween type-only export surface mismatch'],
  ['extra-canonical-type','packages/engine/dist/tweenTypes.d.ts',raw=>raw+'\nexport interface ExtraTweenPort {}\n','engine: canonical Tween type inventory mismatch'],
  ['extra-canonical-erased-alias','packages/engine/dist/tweenTypes.d.ts',raw=>raw+'\nexport type { Tween as ExtraTweenPort };\n','engine: canonical Tween type inventory mismatch'],
  ['wrong-runtime-entry','packages/runtime/dist/index.d.ts',raw=>raw+'\nexport interface Tween {}\n','runtime: Engine-only Tween type leaked: Tween'],
  ['automatic-source-time','packages/engine/src/tween.ts',raw=>raw+'\nconst forbiddenTweenSample = Date.now();\n','packages/engine/src/tween.ts: Tween automatic timing dependency'],
  ['automatic-emitted-timer','packages/engine/dist/tween.js',raw=>raw+'\nsetTimeout(() => {}, 1);\n','packages/engine/dist/tween.js: Tween automatic timing dependency'],
  ['DOM-ambient-reference','packages/engine/src/tweenTypes.ts',raw=>raw+'\n/// <reference lib="dom" />\n','packages/engine/src/tweenTypes.ts: host ambient dependency'],
  ['new-owner-subpath','packages/engine/package.json',raw=>{const p=JSON.parse(raw);p.exports['./tween']={types:'./dist/tween.d.ts',import:'./dist/tween.js'};return JSON.stringify(p);},'engine: text explicit export mapping mismatch'],
];
for(const [name,file,change,reason]of mutations)test(`TW10 ${name} refuses its assigned reason after a valid actual graph`,()=>isolated(f=>{
  checked(f.check(),0);f.edit(file,change);checked(f.check(),1,reason);
}));

// First-party successor for the recorded generic quoted-option false positive.
// Each isolated control proves the genuine graph baseline before changing source.
// These bounded lexical witnesses do not claim complete TypeScript parsing.
test('TW10 ordinary from/to keys and escaped quoted import text remain source data',()=>isolated(f=>{
  checked(f.check(),0);
  f.edit('packages/engine/src/tween.ts',raw=>raw+String.raw`
const tweenBoundaryReadOption = (options: Record<string, number>, key: string, context: object, scope: object) => options[key];
const tweenBoundaryOptions = {from: 0, to: 1}, tweenBoundaryContext = {}, tweenBoundaryScope = {};
const tweenBoundaryFrom = tweenBoundaryReadOption(tweenBoundaryOptions, 'from', tweenBoundaryContext, tweenBoundaryScope);
const tweenBoundaryTo = tweenBoundaryReadOption(tweenBoundaryOptions, 'to', tweenBoundaryContext, tweenBoundaryScope);
const tweenBoundaryQuotedImport = "import '@egret/runtime/text'";
const tweenBoundaryQuotedFrom = 'from "@egret/runtime/text"';
const tweenBoundaryEscapedDouble = "quoted \" import '@egret/runtime/text'";
const tweenBoundaryEscapedSingle = 'quoted \' from "@egret/runtime/text"';
`);
  checked(f.check(),0);
}));
const importClauseMutations=[
  ['zero-whitespace-static-type-from',"import type * as TweenBoundaryText from'@egret/runtime/text';"],
  ['dynamic-import-inner-whitespace',"void import( '@egret/runtime/text');"],
  ['zero-whitespace-side-effect-import',"import'@egret/runtime/text';"],
];
for(const [name,source]of importClauseMutations)test(`TW10 ${name} retains the assigned deep-import refusal`,()=>isolated(f=>{
  checked(f.check(),0);
  f.edit('packages/engine/src/tween.ts',raw=>raw+'\n'+source+'\n');
  checked(f.check(),1,'unapproved/deep package import @egret/runtime/text');
}));

// First-party TW-SCANNER-001 witness for existing comment stripping before scanning.
// A URL's stripped closing quote must not hide a genuine import on the next line.
test('TW10 URL literal before a real static type import retains the deep-import refusal',()=>isolated(f=>{
  checked(f.check(),0);
  f.edit('packages/engine/src/tween.ts',raw=>raw+'\nconst tweenBoundaryUrl = "https://example.test";\nimport type * as TweenBoundaryTextAfterUrl from "@egret/runtime/text";\n');
  checked(f.check(),1,'unapproved/deep package import @egret/runtime/text');
}));

// First-party TW-SCANNER-002 witness: these are actual source continuation bytes,
// not a textual backslash-r/backslash-n representation.
test('TW10 single and double quoted CRLF continuations keep embedded import text as data',()=>isolated(f=>{
  checked(f.check(),0);
  const continuation=String.fromCharCode(92,13,10);
  const doubleQuoted='const tweenBoundaryDoubleContinuation = "safe'+continuation+"import '@egret/runtime/text'\";\n";
  const singleQuoted="const tweenBoundarySingleContinuation = 'safe"+continuation+'from "@egret/runtime/text"\';\n';
  f.edit('packages/engine/src/tween.ts',raw=>raw+'\n'+doubleQuoted+singleQuoted);
  checked(f.check(),0);
}));
