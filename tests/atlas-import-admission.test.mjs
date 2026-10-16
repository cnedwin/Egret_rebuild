// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasImportPlan} from '@egret/project/atlas';
const provenance=()=>({origin:'first-party',license:'Apache-2.0',notice:'Original tiny fixture.'});
function input(){return {profile:'aseprite-json-array-1.3.18.6-v1',source:{id:'tiny',text:'{}',provenance:provenance()},page:{pageName:'tiny.png',assetId:'tiny-asset',width:8,height:8,provenance:provenance()}};}
test('descriptor-faults: original thrown identity, including undefined, exact operation count',()=>{
 for(const operation of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor'])for(const thrown of [{marker:true},undefined]){const request=input();let count=0;const target=request.source;request.source=new Proxy(target,{[operation](...args){count++;throw thrown;}});const r=createAtlasImportPlan(request);assert.equal(r.ok,false);const d=r.diagnostics[0];assert.equal(d.code,'ATLAS_READ_FAILED');assert.equal(d.pointer,operation==='getOwnPropertyDescriptor'?'/source/id':'/source');assert.equal(Object.hasOwn(d,'cause'),true);assert.equal(d.cause,thrown);assert.equal(count,1);assert.equal(Object.isFrozen(thrown??{}),false);assert.equal(Object.hasOwn(d,'span'),false);}
 const proxy=Proxy.revocable({},{});proxy.revoke();const request=input();request.source=proxy.proxy;const r=createAtlasImportPlan(request);assert.equal(r.diagnostics[0].code,'ATLAS_READ_FAILED');assert.equal(r.diagnostics[0].pointer,'/source');assert.equal(Object.hasOwn(r.diagnostics[0],'cause'),true);
});
test('descriptor admission never invokes accessors; structural errors stop capture',()=>{
 let calls=0;const request=input();Object.defineProperty(request.source,'text',{enumerable:true,get(){calls++;throw Error('not read');}});const r=createAtlasImportPlan(request);assert.equal(r.diagnostics[0].code,'ATLAS_INPUT_INVALID');assert.equal(r.diagnostics[0].pointer,'/source/text');assert.equal(calls,0);
 const unknown=input();unknown.extra=true;unknown.page=new Proxy({}, {ownKeys(){throw Error('later');}});assert.equal(createAtlasImportPlan(unknown).diagnostics[0].code,'ATLAS_INPUT_INVALID');
 const missing=input();delete missing.source.text;assert.equal(createAtlasImportPlan(missing).diagnostics[0].code,'ATLAS_INPUT_INVALID');
});

test('whole descriptor capture precedes scalar validation; fixed descriptor order and borrowed cause',()=>{
 const request=input();request.profile=7;const cause={name:'not inspected',code:'not inspected'};Object.defineProperty(cause,'message',{get(){throw Error('cause inspected');}});request.page=new Proxy(request.page,{getOwnPropertyDescriptor(){throw cause;}});const r=createAtlasImportPlan(request);assert.equal(r.diagnostics[0].code,'ATLAS_READ_FAILED');assert.equal(r.diagnostics[0].pointer,'/page/pageName');assert.equal(r.diagnostics[0].cause,cause);assert.equal(Object.isFrozen(cause),false);
 const order=[],ordinary=input();ordinary.source=new Proxy(ordinary.source,{getOwnPropertyDescriptor(target,key){order.push(key);return Reflect.getOwnPropertyDescriptor(target,key);}});createAtlasImportPlan(ordinary);assert.deepEqual(order,['id','text','provenance']);
 for(const invalid of [[],()=>{},new Date(),Object.create({})])assert.equal(createAtlasImportPlan(invalid).diagnostics[0].code,'ATLAS_INPUT_INVALID');
 const nulls=input();nulls.source=Object.assign(Object.create(null),nulls.source);assert.equal(createAtlasImportPlan(nulls).diagnostics[0].code,'ATLAS_SCHEMA_INVALID');
});
test('input identity, primitive Unicode, scalar and provenance budget boundaries',()=>{
 for(const field of ['id','assetId']){const req=input(),owner=field==='id'?req.source:req.page;owner[field]='x'.repeat(256);assert.equal(createAtlasImportPlan(req).diagnostics[0].code,'ATLAS_SCHEMA_INVALID');owner[field]+='x';const d=createAtlasImportPlan(req).diagnostics[0];assert.equal(d.code,'ATLAS_LIMIT_EXCEEDED');assert.equal(d.pointer,field==='id'?'/source/id':'/page/assetId');assert.equal(Object.hasOwn(d,'span'),false);}
 const invalid=input();invalid.source.id='\ud800';assert.equal(createAtlasImportPlan(invalid).diagnostics[0].code,'ATLAS_INPUT_INVALID');
 for(const value of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1,'8']){const req=input();req.page.width=value;assert.equal(createAtlasImportPlan(req).diagnostics[0].code,'ATLAS_INPUT_INVALID');}
 const req=input();for(const owner of [req.source.provenance,req.page.provenance])for(const key of ['origin','license','notice'])owner[key]='x'.repeat(4096);assert.equal(createAtlasImportPlan(req).diagnostics[0].code,'ATLAS_SCHEMA_INVALID');
 req.source.provenance.sha256='a'.repeat(64);req.source.provenance.origin='x'.repeat(4032);assert.equal(createAtlasImportPlan(req).diagnostics[0].code,'ATLAS_SCHEMA_INVALID');req.source.provenance.origin+='x';let d=createAtlasImportPlan(req).diagnostics[0];assert.equal(d.code,'ATLAS_LIMIT_EXCEEDED');assert.equal(d.pointer,'/page/provenance/notice');
 req.source.provenance.origin='x'.repeat(4097);assert.equal(createAtlasImportPlan(req).diagnostics[0].pointer,'/source/provenance/origin');
 const badSha=input();badSha.source.provenance.sha256='A'.repeat(64);assert.equal(createAtlasImportPlan(badSha).diagnostics[0].code,'ATLAS_INPUT_INVALID');
});


// First-party literal fixture for T2-R1-01; no runtime/private SDK imports.
const profileMetadata='{"frames":[{"filename":"one","frame":{"x":0,"y":0,"w":2,"h":3},"rotated":false,"trimmed":true,"spriteSourceSize":{"x":1,"y":1,"w":2,"h":3},"sourceSize":{"w":4,"h":5},"duration":125}],"meta":{"app":"https://www.aseprite.org/","version":"1.3.18.6","image":"tiny.png","format":"RGBA8888","size":{"w":8,"h":8},"scale":"1"}}';
function profileInput(profile,text=profileMetadata){const request=input();request.profile=profile;request.source.text=text;return request;}
function profileDiagnostic(result,code,source,pointer){
 assert.equal(result.ok,false);assert.equal(Object.hasOwn(result,'value'),false);assert.equal(result.diagnostics.length,1);
 const diagnostic=result.diagnostics[0];assert.equal(diagnostic.code,code);assert.equal(diagnostic.source,source);assert.equal(diagnostic.pointer,pointer);assert.equal(diagnostic.severity,'error');
 assert.equal(Object.hasOwn(diagnostic,'relatedSpan'),false);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.diagnostics),true);assert.equal(Object.isFrozen(diagnostic),true);return diagnostic;
}
for(const [label,profile] of [['high','\ud800'],['low','\udc00']])for(const [metadataLabel,text] of [['valid',profileMetadata],['malformed','{']]){
 test('profile Unicode admission: lone '+label+' surrogate with '+metadataLabel+' metadata',()=>{
  const diagnostic=profileDiagnostic(createAtlasImportPlan(profileInput(profile,text)),'ATLAS_INPUT_INVALID','input','/profile');
  assert.equal(diagnostic.message,'Input must use the supported data descriptors.');assert.equal(Object.hasOwn(diagnostic,'span'),false);assert.equal(Object.hasOwn(diagnostic,'cause'),false);
 });
}
test('well-formed unknown profile defers until complete JSON, with no new profile ceiling',()=>{
 assert.equal(createAtlasImportPlan(profileInput('aseprite-json-array-1.3.18.6-v1')).ok,true);
 for(const profile of ['unknown-😀','x'.repeat(1048577)]){
  let diagnostic=profileDiagnostic(createAtlasImportPlan(profileInput(profile,'{')),'ATLAS_JSON_SYNTAX','metadata','');assert.equal(Object.hasOwn(diagnostic,'cause'),false);assert.deepEqual(diagnostic.span,{source:'metadata',sourceId:'tiny',offset:1,length:0,line:1,column:2});
  diagnostic=profileDiagnostic(createAtlasImportPlan(profileInput(profile)),'ATLAS_PROFILE_UNSUPPORTED','input','/profile');assert.equal(Object.hasOwn(diagnostic,'span'),false);assert.equal(Object.hasOwn(diagnostic,'cause'),false);
 }
});
test('complete provenance capture still precedes malformed profile Unicode admission',()=>{
 for(const profile of ['\ud800','\udc00'])for(const cause of [{marker:'original'},undefined]){
  const request=profileInput(profile,'{');let count=0;const order=[];
  request.page.provenance=new Proxy(request.page.provenance,{getOwnPropertyDescriptor(target,key){count++;order.push(key);throw cause;}});
  const diagnostic=profileDiagnostic(createAtlasImportPlan(request),'ATLAS_READ_FAILED','input','/page/provenance/origin');
  assert.equal(count,1);assert.deepEqual(order,['origin']);assert.equal(Object.hasOwn(diagnostic,'cause'),true);assert.equal(diagnostic.cause,cause);assert.equal(Object.hasOwn(diagnostic,'span'),false);if(cause!==undefined)assert.equal(Object.isFrozen(cause),false);
 }
 for(const profile of ['\ud800','\udc00']){
  const request=profileInput(profile);let getterCount=0;
  Object.defineProperty(request.page.provenance,'origin',{enumerable:true,get(){getterCount++;throw Error('must not read');}});
  const diagnostic=profileDiagnostic(createAtlasImportPlan(request),'ATLAS_INPUT_INVALID','input','/page/provenance/origin');assert.equal(getterCount,0);assert.equal(Object.hasOwn(diagnostic,'cause'),false);assert.equal(Object.hasOwn(diagnostic,'span'),false);
 }
});
