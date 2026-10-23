// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {description,entry,clone,BUILD_INPUT_A,runtimeInputA} from './fixtures/resource-manifest.mjs';

const resources=await import('@egret/contracts/resources');
function api(){
  assert.equal(typeof resources.validateResourceBuildPlanDescription,'function','pre-artifact description admission is absent');
  assert.equal(typeof resources.evaluateResourceBuildKeys,'function','pre-artifact key evaluation is absent');
  return resources;
}
const ok=result=>{assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return result.value;};
const refused=(result,code,pointer)=>{
  assert.equal(result.ok,false,'invalid plan admitted');assert.equal(Object.hasOwn(result,'value'),false);
  assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].code,code);
  if(pointer!==undefined)assert.equal(result.diagnostics[0].pointer,pointer);
  return result.diagnostics[0];
};
function plan(complete=description()){
  return {...complete,format:'egret.resource-build-plan/1',entries:complete.entries.map(({artifact,...source})=>source)};
}
const evaluate=input=>ok(api().evaluateResourceBuildKeys(input));
const indexed=value=>Object.fromEntries(value.entries.map(item=>[item.id,item]));
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
function frozen(value){if(value!==null&&typeof value==='object'){assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))frozen(child);}}
const KEY='c9e139dab7d2e2942eaf439ffcf166277705fdccc1bfdaf8501bb984239eb8fa';
const RUNTIME='5e7bfc94c1b2495bbffdf44c4db1eaa7895b9f3df2b0bf6f4d301f40f9fc8feb';
const WIRE='{"entries":[{"artifact":{"byteLength":0,"id":"f_artifact","mediaType":"text/plain","path":"assets/a.txt","role":"asset","sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},"artifactFormatVersion":"text/1","buildKey":"c9e139dab7d2e2942eaf439ffcf166277705fdccc1bfdaf8501bb984239eb8fa","dependencies":[],"id":"e_a","importer":{"id":"egret.copy","version":"1.0.0"},"provenance":{"license":"Apache-2.0","origin":"first-party"},"resourceKind":"text","runtimeIdentity":"5e7bfc94c1b2495bbffdf44c4db1eaa7895b9f3df2b0bf6f4d301f40f9fc8feb","settings":{"alpha":1,"zeta":"雪"},"source":{"byteLength":3,"id":"f_source","mediaType":"application/octet-stream","path":"sources/a.txt","role":"source","sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},"targetProfile":"web-shared/1"}],"format":"egret.resource-manifest/1","projectId":"p_demo","targetProfile":"web-shared/1","versions":{"engineVersion":"0.0.0","resourceFormatVersion":"1.0","toolProtocolVersion":"1.0"}}';

// Break caught: a second projection changes old keys, runtime identity or wire bytes.
test('pre-artifact keys match literal legacy identities and canonical manifest bytes',()=>{
  const keyed=evaluate(plan()),manifest=ok(resources.buildResourceManifest(description()));
  assert.equal(keyed.entries[0].buildKey,KEY);assert.equal(sha(BUILD_INPUT_A),KEY);
  assert.equal(manifest.entries[0].buildKey,KEY);assert.equal(manifest.entries[0].runtimeIdentity,RUNTIME);
  assert.equal(sha(runtimeInputA(KEY)),RUNTIME);assert.equal(ok(resources.serializeResourceManifest(manifest)),WIRE);
  assert.deepEqual(resources.getResourceManifestIdentityInputs(manifest,'e_a'),{build:BUILD_INPUT_A,runtime:runtimeInputA(KEY)});
  assert.equal(resources.isAdmittedResourceManifest(keyed),false);refused(resources.serializeResourceManifest(keyed),'RESOURCE_INPUT_INVALID','');
  assert.equal(keyed.format,'egret.resource-build-keys/1');assert.equal(Object.hasOwn(keyed.entries[0],'artifact'),false);
  assert.equal(Object.hasOwn(keyed.entries[0],'runtimeIdentity'),false);frozen(keyed);
});

// Break caught: declaration order affects graph evaluation or metadata keeps caller aliases.
test('plan validation copies source metadata and canonicalizes declaration order without keys',async()=>{
  const raw=plan(description([entry('e_c',['e_b','e_a']),entry('e_b'),entry('e_a')]));
  const value=ok(api().validateResourceBuildPlanDescription(raw));
  assert.deepEqual(value.entries.map(item=>item.id),['e_a','e_b','e_c']);frozen(value);
  assert.equal(value.format,'egret.resource-build-plan/1');assert.equal(Object.hasOwn(value.entries[0],'buildKey'),false);
  assert.equal(resources.isAdmittedResourceManifest(value),false);
  const reordered={...raw,entries:[...raw.entries].reverse()};assert.deepEqual(evaluate(raw),evaluate(reordered));
  raw.entries[2].settings.alpha=9;raw.versions.engineVersion='9';assert.equal(value.entries[0].settings.alpha,1);assert.equal(value.versions.engineVersion,'0.0.0');
  const root=await import('@egret/contracts');assert.equal(Object.hasOwn(root,'evaluateResourceBuildKeys'),false);assert.equal(Object.hasOwn(root,'validateResourceBuildPlanDescription'),false);
});

// Break caught: project binding leaks into an intrinsic leaf key, or dependency IDs/order disappear.
test('leaf rebinding preserves keys while dependency identity and order remain semantic',()=>{
  const original=plan(),rebound=clone(original);rebound.projectId='p_elsewhere';rebound.entries[0].id='e_other';
  rebound.entries[0].source.id='f_elsewhere';rebound.entries[0].source.path='different/source.bin';rebound.entries[0].source.mediaType='text/plain';
  assert.equal(evaluate(original).entries[0].buildKey,evaluate(rebound).entries[0].buildKey);
  const dag=plan(description([entry('e_a'),entry('e_b'),entry('e_c',['e_a','e_b'])]));
  const before=indexed(evaluate(dag)),order=clone(dag);order.entries[2].dependencies.reverse();
  assert.notEqual(indexed(evaluate(order)).e_c.buildKey,before.e_c.buildKey);
  const renamed=clone(dag);renamed.entries[0].id='e_renamed';renamed.entries[2].dependencies[0]='e_renamed';
  const after=indexed(evaluate(renamed));assert.equal(after.e_renamed.buildKey,before.e_a.buildKey);assert.notEqual(after.e_c.buildKey,before.e_c.buildKey);
  const complete=description(dag.entries.map(item=>({...item,artifact:entry().artifact})));
  assert.deepEqual(ok(resources.buildResourceManifest(complete)).entries.map(item=>item.buildKey),evaluate(dag).entries.map(item=>item.buildKey));
});

// Break caught: settings, importer, provenance, source or common versions stop invalidating the closure.
test('all historical build inputs invalidate the same dependency closure before artifacts exist',()=>{
  const raw=plan(description([entry('e_a'),entry('e_b',['e_a']),entry('e_c')]));
  const before=indexed(evaluate(raw));
  for(const mutate of [e=>{e.resourceKind='image';},e=>{e.source.sha256='1'.repeat(64);},e=>{e.source.byteLength=4;},e=>{e.importer.id='other';},e=>{e.importer.version='2';},e=>{e.settings.alpha=2;},e=>{e.artifactFormatVersion='2';},e=>{e.provenance.origin='other';}]){
    const next=clone(raw);
    // Shared source IDs must remain internally consistent while the changed source gets a fresh binding.
    next.entries[0].source.id='f_changed';next.entries[0].source.path='sources/changed.txt';mutate(next.entries[0]);
    const after=indexed(evaluate(next));assert.notEqual(after.e_a.buildKey,before.e_a.buildKey);assert.notEqual(after.e_b.buildKey,before.e_b.buildKey);assert.equal(after.e_c.buildKey,before.e_c.buildKey);
  }
  for(const mutate of [p=>{p.versions.engineVersion='2';},p=>{p.versions.resourceFormatVersion='2';},p=>{p.targetProfile='other/1';p.entries.forEach(e=>{e.targetProfile=p.targetProfile;});}]){
    const next=clone(raw);mutate(next);for(const item of evaluate(next).entries)assert.notEqual(item.buildKey,before[item.id].buildKey);
  }
});

// Break caught: pre-artifact schema accepts artifact claims/extras or bypasses source invariants.
test('plan schema refuses artifacts, extras and malformed source bindings with stable diagnostics',()=>{
  for(const check of [input=>api().validateResourceBuildPlanDescription(input),input=>api().evaluateResourceBuildKeys(input)]){
    for(const [mutate,code,pointer] of [
      [p=>{p.entries[0].artifact=entry().artifact;},'RESOURCE_INPUT_INVALID','/entries/0'],
      [p=>{p.entries[0].buildKey=KEY;},'RESOURCE_INPUT_INVALID','/entries/0'],
      [p=>{p.extra=true;},'RESOURCE_INPUT_INVALID',''],
      [p=>{p.entries[0].source.role='asset';},'RESOURCE_FILE_MISMATCH','/entries/0/source/role'],
      [p=>{p.entries[0].source.path='../escape';},'RESOURCE_PATH_INVALID','/entries/0/source/path'],
      [p=>{p.entries[0].source.sha256='A'.repeat(64);},'RESOURCE_INPUT_INVALID','/entries/0/source/sha256'],
      [p=>{p.entries[0].source.byteLength=-0;},'RESOURCE_INPUT_INVALID','/entries/0/source/byteLength'],
      [p=>{p.entries[0].importer.extra=1;},'RESOURCE_INPUT_INVALID','/entries/0/importer'],
      [p=>{p.format='egret.resource-build/1';},'RESOURCE_FORMAT_UNSUPPORTED','/format']
    ]){const raw=plan();mutate(raw);refused(check(raw),code,pointer);}
    const conflict=plan(description([entry('e_a'),entry('e_b')]));conflict.entries[1].source.sha256='2'.repeat(64);refused(check(conflict),'RESOURCE_FILE_MISMATCH','/entries/1/source');
    const pathAlias=plan(description([entry('e_a'),entry('e_b')]));pathAlias.entries[1].source.id='f_other';pathAlias.entries[1].source.path='SOURCES/a.txt';refused(check(pathAlias),'RESOURCE_FILE_MISMATCH','/entries/1/source/path');
  }
  const missing=description();delete missing.entries[0].artifact;refused(resources.buildResourceManifest(missing),'RESOURCE_INPUT_INVALID','/entries/0');
});

// Break caught: descriptor capture invokes getters or semantic work precedes complete capture.
test('plan capture never invokes accessors and precedes semantic validation',()=>{
  for(const method of ['validateResourceBuildPlanDescription','evaluateResourceBuildKeys']){
    let reads=0;const raw=plan();raw.format='unsupported';Object.defineProperty(raw.entries[0].source,'path',{enumerable:true,get(){reads++;throw Error('getter');}});
    refused(api()[method](raw),'RESOURCE_INPUT_INVALID','/entries/0/source/path');assert.equal(reads,0);
    const cycle=plan();cycle.entries[0].settings.self=cycle.entries[0].settings;refused(resources[method](cycle),'RESOURCE_INPUT_INVALID','/entries/0/settings/self');
    const sparse=plan();sparse.entries=new Array(1);refused(resources[method](sparse),'RESOURCE_INPUT_INVALID','/entries');
  }
});

// Break caught: missing/cyclic/repeated dependencies or memoized DAG height evade shared graph rules.
test('pre-artifact graph admission retains missing, cyclic, duplicate and longest-path refusals',()=>{
  for(const [entries,code,pointer] of [
    [[entry('e_a',['e_missing'])],'RESOURCE_DEPENDENCY_INVALID','/entries/0/dependencies'],
    [[entry('e_a',['e_a'])],'RESOURCE_DEPENDENCY_INVALID','/entries/0/dependencies'],
    [[entry('e_a',['e_b']),entry('e_b',['e_a'])],'RESOURCE_DEPENDENCY_INVALID','/entries/0/dependencies'],
    [[entry('e_a'),entry('e_a')],'RESOURCE_ID_DUPLICATE','/entries/1/id'],
    [[entry('e_a'),entry('e_b',['e_a','e_a'])],'RESOURCE_DEPENDENCY_INVALID','/entries/1/dependencies/1']
  ])refused(api().evaluateResourceBuildKeys(plan(description(entries))),code,pointer);
  const joined=length=>plan(description([entry('e_root',['e_leaf','e_chain'+(length-1)]),entry('e_leaf'),...Array.from({length},(_,i)=>entry('e_chain'+i,[i?'e_chain'+(i-1):'e_leaf'])).reverse()]));
  assert.equal(evaluate(joined(30)).entries.length,32);refused(resources.evaluateResourceBuildKeys(joined(31)),'RESOURCE_LIMIT_EXCEEDED');
});

// Break caught: new entry skips count/edge/UTF-8/settings/capture work budgets.
test('pre-artifact plans enforce resource, edge, settings and total captured byte budgets',()=>{
  const many=Array.from({length:4096},(_,i)=>entry('e_'+i));assert.equal(evaluate(plan(description(many))).entries.length,4096);
  refused(resources.evaluateResourceBuildKeys(plan(description([...many,entry('e_over')]))),'RESOURCE_LIMIT_EXCEEDED','/entries');
  const leaves=Array.from({length:128},(_,i)=>entry('e_l'+i)),parents=Array.from({length:64},(_,i)=>entry('e_p'+i,leaves.map(item=>item.id)));
  evaluate(plan(description([...leaves,...parents])));refused(resources.evaluateResourceBuildKeys(plan(description([...leaves,...parents,entry('e_over',['e_l0'])]))),'RESOURCE_LIMIT_EXCEEDED');
  const exact=plan();exact.entries[0].settings={text:'x'.repeat(65525)};evaluate(exact);
  exact.entries[0].settings.text+='x';refused(resources.evaluateResourceBuildKeys(exact),'RESOURCE_LIMIT_EXCEEDED','/entries/0/settings');
  const unicode=plan();unicode.entries[0].settings={text:'雪'.repeat(21842)};refused(resources.evaluateResourceBuildKeys(unicode),'RESOURCE_LIMIT_EXCEEDED','/entries/0/settings');
  const huge=plan(description(Array.from({length:70},(_,i)=>({...entry('e_'+i),settings:{text:'x'.repeat(60000)}}))));refused(resources.evaluateResourceBuildKeys(huge),'RESOURCE_LIMIT_EXCEEDED');
});
