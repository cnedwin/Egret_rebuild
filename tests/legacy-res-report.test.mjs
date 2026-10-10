import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { analyzeLegacyResourceManifest as analyze } from '../packages/project/dist/legacy-res-report.js';
import { readLegacyResourceJSON as readJSON } from '../packages/project/dist/legacy-res-json.js';
import { createScanner, visit } from '../packages/project/dist/json-foundation.js';
import { utf8Length } from '../packages/project/dist/unicode.js';
import { isPortablePath, pathCollisionKey } from '../packages/project/dist/paths.js';

// All fixtures and expected declarations are independently invented for this profile.
const hero = { name: 'hero', type: 'image', url: 'assets/hero.png' };
const settings = { name: 'settings', type: 'json', url: 'data/settings.json' };
const manifest = (resources = [], groups = [], extra = {}) => JSON.stringify({ resources, groups, ...extra });
const acceptance = { fileExistence:'unverified', decoding:'unverified', execution:'unverified', migration:'unverified' };
function failure(result, code, pointer = '', source = 'text', status = 'invalid') {
  assert.equal(result.status, status); assert.equal(result.resourceRoot,null); assert.equal(result.originalText,null);
  assert.deepEqual(result.resources,[]); assert.deepEqual(result.groups,[]); assert.equal(result.diagnostics.length,1);
  const d=result.diagnostics[0]; assert.equal(d.code,code); assert.equal(d.source,source);
  assert.equal(d.severity,'error'); assert.equal(d.jsonPointer,pointer); assert.equal(typeof d.message,'string');
  assert.deepEqual(Object.keys(d).sort(),['code','jsonPointer','message','severity','source']);
  assert.deepEqual(result.acceptance,acceptance);
}
function frozen(value) { if(value && typeof value==='object') { assert.ok(Object.isFrozen(value)); for(const v of Object.values(value)) frozen(v); } }
const warn = (code,pointer) => ({code,source:'text',severity:'warning',jsonPointer:pointer});
const warningView = r => r.diagnostics.map(({message,...d})=>d);

// Test-only VM instrumentation executes the actual emitted modules, retaining their
// function bodies and substituting only explicit import/native bindings. No product
// test hooks, copied parser grammar, or upstream internal imports are involved.
function instrument(which, replacements = {}, prelude = '') {
  const url = new URL(`../packages/project/dist/legacy-res-${which}.js`,import.meta.url);
  const bytes=readFileSync(url); const source=bytes.toString('utf8');
  assert.ok(source.includes(which==='json' ? 'function readLegacyResourceJSON' : 'function analyzeLegacyResourceManifest'));
  const removed=[];
  const executable=source.replace(/^import .*;\r?\n/gm,line=>{removed.push(line); return '';}).replace(/^export /gm,'');
  assert.deepEqual(removed.map(line=>line.trim()),which==='json' ? [
    'import { createScanner, visit } from "./json-foundation.js";',
    'import { utf8Length } from "./unicode.js";'
  ] : [
    'import { readLegacyResourceJSON } from "./legacy-res-json.js";',
    'import { utf8Length } from "./unicode.js";',
    'import { isPortablePath, pathCollisionKey } from "./paths.js";'
  ]);
  const bindings={createScanner,visit,utf8Length,isPortablePath,pathCollisionKey,readLegacyResourceJSON:readJSON,...replacements};
  const name=which==='json'?'readLegacyResourceJSON':'analyzeLegacyResourceManifest';
  const fn=runInNewContext(`${prelude}\n${executable}\n${name};`,bindings);
  return { run:(...args)=>structuredClone(fn(...args)), sha256:createHash('sha256').update(bytes).digest('hex') };
}

test('literal recognized report preserves order and duplicate declaration relations',()=>{
  const text=manifest([hero,settings],[{name:'start',keys:'hero,settings,hero'},{name:'empty',keys:''}]);
  assert.deepEqual(analyze(text,'resource'),{
    reportVersion:'0.1',scope:'legacy-res-declarations',profile:'legacy-res-comma-declarations-0.1',status:'recognized',
    resourceRoot:'resource',originalText:text,
    resources:[{...hero,projectPath:'resource/assets/hero.png',structuralStatus:'recognized'},
      {...settings,projectPath:'resource/data/settings.json',structuralStatus:'recognized'}],
    groups:[{name:'start',keys:'hero,settings,hero',declaredKeys:[{key:'hero',relation:'resource'},{key:'settings',relation:'resource'},{key:'hero',relation:'resource'}]},
      {name:'empty',keys:'',declaredKeys:[]}],diagnostics:[],acceptance
  });
});
test('fresh deeply frozen ownership includes every success and failure empty array',()=>{
  for(const text of [manifest(),manifest([hero],[{name:'g',keys:'hero'}]),'x',manifest([],[],{extra:1})]) {
    const a=analyze(text,'resource'),b=analyze(text,'resource'); frozen(a); frozen(b);
    assert.notEqual(a,b); for(const k of ['resources','groups','diagnostics','acceptance']) assert.notEqual(a[k],b[k]);
  }
});
test('primitive inputs and precise input precedence never coerce caller objects',()=>{
  const poison={toString(){throw Error('must never coerce');},get resources(){throw Error('must never read');}};
  failure(analyze(poison,poison),'LEGACY_RES_INPUT_INVALID');
  failure(analyze('\ud800',poison),'LEGACY_RES_INPUT_INVALID','','resourceRoot');
  failure(analyze('\ud800','x'.repeat(4097)),'LEGACY_RES_INPUT_INVALID');
  failure(analyze('x'.repeat(1048577)+'\ud800','\ud800'),'LEGACY_RES_LIMIT_EXCEEDED');
  failure(analyze(manifest(),'x'.repeat(4097)+'\ud800'),'LEGACY_RES_LIMIT_EXCEEDED','','resourceRoot');
  failure(analyze(manifest(),'\ud800'),'LEGACY_RES_INPUT_INVALID','','resourceRoot');
  failure(analyze(manifest(),'é'.repeat(2048)),'LEGACY_RES_PATH_INVALID','','resourceRoot');
  failure(analyze(manifest(),'é'.repeat(2048)+'a'),'LEGACY_RES_LIMIT_EXCEEDED','','resourceRoot');
});
test('code-unit admission rejects before calling the Unicode helper',()=>{
  let calls=0; const helper=s=>{calls++;return utf8Length(s);};
  const a=instrument('json',{utf8Length:helper}); assert.equal(a.run(' '.repeat(1048577)).diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED'); assert.equal(calls,0);
  const r=instrument('report',{utf8Length:helper}); failure(r.run(' '.repeat(1048577),'r'),'LEGACY_RES_LIMIT_EXCEEDED'); assert.equal(calls,0);
  failure(r.run(manifest(),'x'.repeat(4097)),'LEGACY_RES_LIMIT_EXCEEDED','','resourceRoot'); assert.equal(calls,1);
});
test('strict grammar rejects BOM/comments/trailing commas/empty/recovery and duplicates',()=>{
  for(const text of ['', '\ufeff{}','/* unclosed','{"resources":[],"groups":[],}', '{/*x*/"resources":[],"groups":[]}', '{} {}', '[}', '{"a":1,"\\u0061":2}', '{"x":{"a":1,"a":2}}']) {
    failure(analyze(text,'resource'),'LEGACY_RES_SYNTAX_INVALID');
  }
  failure(analyze('bad','../bad'),'LEGACY_RES_SYNTAX_INVALID');
  failure(analyze('{"resources":[],"groups":[],"x":"\\ud800"}','resource'),'LEGACY_RES_INPUT_INVALID','/x');
  failure(analyze('{"\\ud800":0}','resource'),'LEGACY_RES_INPUT_INVALID','/\ud800');
});
test('visitor key and string Unicode limits use escaped RFC6901 pointers',()=>{
  assert.equal(readJSON(JSON.stringify({'a~/b':'é'.repeat(2048)})).status,'ok');
  let result=readJSON(JSON.stringify({'a~/b':'é'.repeat(2048)+'a'}));
  assert.equal(result.status,'invalid');assert.equal(result.diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED');assert.equal(result.diagnostic.jsonPointer,'/a~0~1b');
  assert.equal(readJSON(JSON.stringify({['a'.repeat(4096)]:0})).status,'ok');
  result=readJSON(JSON.stringify({['a'.repeat(4097)]:0}));assert.equal(result.diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED');
});
test('exact raw UTF8 and depth budgets precede private graph allocation',()=>{
  assert.equal(readJSON('0'+' '.repeat(1048575)).status,'ok');
  assert.equal(readJSON('0'+' '.repeat(1048576)).diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED');
  assert.equal(readJSON('"é"'+' '.repeat(1048572)).status,'ok');
  assert.equal(readJSON('"é"'+' '.repeat(1048573)).diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED');
  assert.equal(readJSON('['.repeat(16)+'0'+']'.repeat(16)).status,'ok');
  assert.equal(readJSON('['.repeat(17)+'0'+']'.repeat(17)).diagnostic.code,'LEGACY_RES_LIMIT_EXCEEDED');
});
test('strict failure never reaches native parse; unexpected native throw is incomplete without coercion',()=>{
  let calls=0; const cause={toString(){throw Error('coercion');}};
  const json=instrument('json',{JSON:{parse(){calls++;throw cause;}}});
  assert.equal(json.run('{"x":1,}').status,'invalid');assert.equal(calls,0);
  const result=json.run('{"x":1}'); assert.equal(calls,1);assert.equal(result.status,'incomplete');
  assert.deepEqual({...result.diagnostic},{code:'LEGACY_RES_INTERNAL_FAILED',source:'text',severity:'error',jsonPointer:'',message:'Resource declaration analysis failed internally.'});
  const report=instrument('report',{readLegacyResourceJSON:json.run}); failure(report.run(manifest(),'resource'),'LEGACY_RES_INTERNAL_FAILED','','text','incomplete');
});
test('scanner lexical errors win over overrun; error0 faults cannot authenticate source invalid',()=>{
  const fields={kind:17,error:0,position:0,offset:0,length:0};
  const scanner=overrides=>()=>{const f={...fields,...overrides};return {scan:()=>f.kind,getTokenError:()=>f.error,getPosition:()=>f.position,getTokenOffset:()=>f.offset,getTokenLength:()=>f.length};};
  for(const overrides of [{kind:1},{position:1,length:1},{error:7},{error:NaN},{kind:18},{kind:1.5},{offset:-1},{length:-1},{position:2,length:2},{kind:1,length:0}]) {
    const r=instrument('json',{createScanner:scanner(overrides)}).run('0');assert.equal(r.status,'incomplete');assert.equal(r.diagnostic.code,'LEGACY_RES_INTERNAL_FAILED');
  }
  const lexical=instrument('json',{createScanner:scanner({error:1,position:100,length:100})}).run('0');assert.equal(lexical.status,'invalid');assert.equal(lexical.diagnostic.code,'LEGACY_RES_SYNTAX_INVALID');
  assert.equal(readJSON('/*').diagnostic.code,'LEGACY_RES_SYNTAX_INVALID');
  const thrown=instrument('json',{createScanner(){throw {toString(){throw Error('coercion');}};}}).run('0');assert.equal(thrown.status,'incomplete');
  let scans=0; const exact=instrument('json',{createScanner(){let end=false;return {
    scan(){scans++;end=scans===2;return end?17:11;}, getTokenError:()=>0,
    getPosition:()=>1,getTokenOffset:()=>end?1:0,getTokenLength:()=>end?0:1
  };}}).run('0'); assert.equal(exact.status,'ok');assert.equal(exact.value,0);assert.equal(scans,2);
  const lexicalFirst=instrument('json',{createScanner:()=>({scan:()=>1,getTokenError:()=>1,
    getPosition(){throw Error('must not read after lexical rejection');},getTokenOffset(){throw {};},getTokenLength(){throw {};}})}).run('0');
  assert.equal(lexicalFirst.status,'invalid');assert.equal(lexicalFirst.diagnostic.code,'LEGACY_RES_SYNTAX_INVALID');
});
test('visitor foreign throws and recovery during copy/publication stay incomplete',()=>{
  const r=instrument('json',{visit(){throw Object.freeze({});}}).run('0');assert.equal(r.status,'incomplete');
  let failed=false;
  const copy=instrument('report',{Object:{...Object,keys(){if(!failed){failed=true;throw {}; } return [];},freeze:Object.freeze,hasOwn:Object.hasOwn}});
  failure(copy.run(manifest(),'resource'),'LEGACY_RES_INTERNAL_FAILED','','text','incomplete');
  let freezes=0;
  const publication=instrument('report',{Object:{...Object,keys:Object.keys,hasOwn:Object.hasOwn,freeze(value){if(++freezes===1) throw {};return Object.freeze(value);}}});
  failure(publication.run(manifest(),'resource'),'LEGACY_RES_INTERNAL_FAILED','','text','incomplete');
});
test('required root shape and required field precedence are fixed',()=>{
  for(const text of ['null','[]','1','"x"']) failure(analyze(text,'resource'),'LEGACY_RES_INPUT_INVALID');
  failure(analyze('{"resources":null,"groups":null}','resource'),'LEGACY_RES_INPUT_INVALID','/resources');
  failure(analyze('{"resources":[],"groups":null}','resource'),'LEGACY_RES_INPUT_INVALID','/groups');
  failure(analyze(manifest([{name:'',type:0,url:0,subkeys:0,scale9grid:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0/name');
  failure(analyze(manifest([{name:'r',type:0,url:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0/type');
  failure(analyze(manifest([{name:'r',type:'image',url:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0/url');
  failure(analyze(manifest([{...hero,subkeys:0,scale9grid:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0/subkeys');
  failure(analyze(manifest([{...hero,scale9grid:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0/scale9grid');
  failure(analyze(manifest([null],[{name:'',keys:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/resources/0');
  failure(analyze(manifest([],[{name:'',keys:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/groups/0/name');
  failure(analyze(manifest([],[{name:'g'}]),'resource'),'LEGACY_RES_INPUT_INVALID','/groups/0/keys');
  failure(analyze(manifest([{...hero,url:''}],[{name:'g',keys:0}]),'resource'),'LEGACY_RES_INPUT_INVALID','/groups/0/keys');
});
test('exact resource and group array caps are checked before records',()=>{
  const resources=Array.from({length:4096},(_,i)=>({name:`r${i}`,type:'image',url:'same.png'}));
  assert.equal(analyze(manifest(resources),'resource').resources.length,4096);
  failure(analyze(manifest([...resources,{}]),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/resources');
  const groups=Array.from({length:1024},(_,i)=>({name:`g${i}`,keys:''}));
  assert.equal(analyze(manifest([],groups),'resource').groups.length,1024);
  failure(analyze(manifest([{}],[...groups,{}]),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups');
  failure(analyze(manifest([...resources,{}],null),'resource'),'LEGACY_RES_INPUT_INVALID','/groups');
});
test('duplicate namespaces are exact, separate and ordered before URL validation',()=>{
  failure(analyze(manifest([hero,{...hero,url:''}],[{name:'g',keys:''},{name:'g',keys:''}]),'resource'),'LEGACY_RES_NAME_DUPLICATE','/resources/1/name');
  failure(analyze(manifest([{...hero,url:''}],[{name:'g',keys:''},{name:'g',keys:''}]),'resource'),'LEGACY_RES_NAME_DUPLICATE','/groups/1/name');
  assert.equal(analyze(manifest([hero,{...hero,name:'Hero'}],[{name:'hero',keys:'hero,Hero'}]),'resource').status,'recognized');
});
test('portable roots and literal joined byte limits use existing policy',()=>{
  for(const root of ['','../r','/r','r\\x','NUL','a//b','a.']) failure(analyze(manifest(),root),'LEGACY_RES_PATH_INVALID','','resourceRoot');
  const root='r'.repeat(1024);assert.equal(analyze(manifest(),root).status,'recognized');
  failure(analyze(manifest(),'r'.repeat(1025)),'LEGACY_RES_PATH_INVALID','','resourceRoot');
  assert.equal(analyze(manifest([{...hero,url:'a'}]),'r'.repeat(1022)).status,'recognized');
  failure(analyze(manifest([{...hero,url:'a'}]),'r'.repeat(1023)),'LEGACY_RES_PATH_INVALID','/resources/0/url');
});
test('nine mixed URL controls preserve exact ordered classification',()=>{
  for(const [url,status] of [['//host\\x','unsupported'],['C:foo','unsupported'],['C:/foo','invalid'],['../hero.png?x','unsupported'],['../hero.png','invalid'],['/hero.png?x','invalid'],['hero\\x?y','invalid'],['a//b?x','unsupported'],['a//b','invalid']]) {
    const result=analyze(manifest([{...hero,url}]),'resource');assert.equal(result.status,status,url);
    if(status==='invalid') failure(result,'LEGACY_RES_PATH_INVALID','/resources/0/url');
    else {assert.equal(result.resources[0].url,url);assert.equal(result.resources[0].projectPath,null);assert.deepEqual(warningView(result),[warn('LEGACY_RES_URL_UNSUPPORTED','/resources/0/url')]);}
  }
  for(const url of ['','/a','a\\b','C:\\a','./a','a/../b','a//b','NUL.png','a|b','a\u0001b']) failure(analyze(manifest([{...hero,url}]),'resource'),'LEGACY_RES_PATH_INVALID','/resources/0/url');
  for(const url of ['https://host/a','a#x','a%x','a?x']) assert.equal(analyze(manifest([{...hero,url}]),'resource').status,'unsupported');
});
test('same-spelling aliases are preserved while case and NFC collisions reject',()=>{
  assert.equal(analyze(manifest([hero,{...hero,name:'alias'}]),'resource').status,'recognized');
  for(const [a,b] of [['A.png','a.png'],['é.png','e\u0301.png']]) failure(analyze(manifest([{...hero,url:a},{...hero,name:'other',url:b}]),'resource'),'LEGACY_RES_PATH_COLLISION','/resources/1/url');
});
test('unknown schema retains exact primitive source and picks first sorted escaped key',()=>{
  const text=' {"resources":[],"groups":[],"z":1e999,"a~/b":0} ';
  const result=analyze(text,'resource');assert.equal(result.status,'unsupported');assert.equal(result.originalText,text);assert.deepEqual(result.resources,[]);assert.deepEqual(result.groups,[]);assert.equal(result.resourceRoot,'resource');
  assert.deepEqual(warningView(result),[warn('LEGACY_RES_SCHEMA_UNSUPPORTED','/a~0~1b')]);
  const resource=analyze(manifest([{...hero,z:0,a:0}],[{name:'g',keys:'',a:0}]),'resource');assert.equal(resource.diagnostics[0].jsonPointer,'/resources/0/a');
  const group=analyze(manifest([hero],[{name:'g',keys:'',z:0,a:0}]),'resource');assert.equal(group.diagnostics[0].jsonPointer,'/groups/0/a');
  failure(analyze(manifest([{...hero,url:''}],[],{unknown:0}),'resource'),'LEGACY_RES_PATH_INVALID','/resources/0/url');
});
test('unsupported resources retain optional strings and warnings in field then token order',()=>{
  const result=analyze(manifest([{name:'atlas',type:'sheet',url:'atlas.json?x',subkeys:'hero,part',scale9grid:'0,0,2,2'},hero],
    [{name:'g',keys:'atlas, hero,,missing,hero#part,atlas'}]),'resource');
  assert.equal(result.status,'unsupported');assert.equal(result.resources[0].structuralStatus,'unsupported');assert.equal(result.resources[0].subkeys,'hero,part');assert.equal(result.resources[0].scale9grid,'0,0,2,2');
  assert.ok(!Object.hasOwn(result.resources[1],'subkeys'));assert.ok(!Object.hasOwn(result.resources[1],'scale9grid'));
  assert.deepEqual(result.groups[0].declaredKeys,[{key:'atlas',relation:'resource'},{key:' hero',relation:'unresolved'},{key:'',relation:'unresolved'},{key:'missing',relation:'unresolved'},{key:'hero#part',relation:'unresolved'},{key:'atlas',relation:'resource'}]);
  assert.deepEqual(warningView(result),[warn('LEGACY_RES_TYPE_UNSUPPORTED','/resources/0/type'),warn('LEGACY_RES_URL_UNSUPPORTED','/resources/0/url'),warn('LEGACY_RES_SUBKEYS_UNSUPPORTED','/resources/0/subkeys'),warn('LEGACY_RES_SCALE9GRID_UNSUPPORTED','/resources/0/scale9grid'),...Array.from({length:4},()=>warn('LEGACY_RES_REFERENCE_UNRESOLVED','/groups/0/keys'))]);
});
test('aggregate comma count admits 16384 and rejects 16385 before split and schema fallback',()=>{
  // 16 strings of 2047 bytes each remain below the decoded 4096-byte gate.
  const resources=[{name:'x',type:'image',url:'x.png'}];
  const groups=Array.from({length:16},(_,i)=>({name:`g${i}`,keys:Array(1024).fill('x').join(',')}));
  const result=analyze(manifest(resources,groups),'resource');assert.equal(result.status,'recognized');assert.equal(result.groups.reduce((n,g)=>n+g.declaredKeys.length,0),16384);
  groups.push({name:'overflow',keys:'x'});failure(analyze(manifest(resources,groups,{extra:true}),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups/16/keys');
  // Stub portable policy only to distinguish keys allocation: in this test-owned
  // realm every split would throw; aggregate rejection must happen before it.
  const module=instrument('report',{isPortablePath:()=>true},'String.prototype.split=function(){throw {};};');
  failure(module.run(manifest(resources,groups),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups/16/keys');
  // Empty/whitespace/repeated keys still count as literal declarations, not
  // aliases or trimmed tokens; each string remains below the decoded byte cap.
  const literalGroups=Array.from({length:8},(_,i)=>({name:`literal${i}`,keys:','.repeat(2047)}));
  failure(analyze(manifest([],literalGroups),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups/0/keys');
  literalGroups.push({name:'one-more',keys:' '});
  failure(module.run(manifest([],literalGroups),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups/8/keys');
});
test('warning cap admits 256 and rejects a late 257 without partial inventory',()=>{
  const groups=[{name:'g',keys:Array(256).fill('missing').join(',')}];
  const good=analyze(manifest([hero],groups),'resource');assert.equal(good.status,'unsupported');assert.equal(good.diagnostics.length,256);assert.equal(good.groups[0].declaredKeys.length,256);
  groups[0].keys+=',missing';failure(analyze(manifest([hero],groups),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/groups/0/keys');
  const resources=Array.from({length:257},(_,i)=>({name:`r${i}`,type:'sheet',url:'same.png'}));failure(analyze(manifest(resources),'resource'),'LEGACY_RES_LIMIT_EXCEEDED','/resources/256/type');
});
