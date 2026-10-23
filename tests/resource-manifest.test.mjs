// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {parseProjectSnapshot} from '@egret/project';
import {description,entry,file,snapshot,clone,BUILD_INPUT_A,runtimeInputA,EMPTY_SHA256,ABC_SHA256} from './fixtures/resource-manifest.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
// An intentional assertion reports the absent public API as the first RED.
// Import-loader errors are retained as context, never accepted as test proof.
const contracts=await import('@egret/contracts/resources').catch(error=>({missing:error.message}));
const project=await import('@egret/project/resources').catch(error=>({missing:error.message}));
function api(){assert.equal(typeof contracts.buildResourceManifest,'function','M1.5 contracts resource admission is absent: '+(contracts.missing??''));assert.equal(typeof project.describeResourceBuild,'function','M1.5 project resource adapter is absent: '+(project.missing??''));return contracts;}
function ok(result){assert.equal(result.ok,true,JSON.stringify(result.diagnostics));return result.value;}
function refuse(result){assert.equal(result.ok,false,'invalid metadata was admitted');assert.ok(result.diagnostics.length>0);assert.equal(Object.hasOwn(result,'value'),false);return result.diagnostics[0];}
function build(input=description()){return ok(api().buildResourceManifest(input));}
function wire(manifest=build()){return clone(manifest);}
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const byId=manifest=>Object.fromEntries(manifest.entries.map(item=>[item.id,item]));
function frozen(value){if(value!==null&&typeof value==='object'){assert.equal(Object.isFrozen(value),true);for(const item of Object.values(value))frozen(item);}}

// Break caught: the new optional APIs are absent, leaked at the roots or omitted.
test('optional public entry availability is an explicit assertion',async()=>{
 api();assert.deepEqual(Object.keys(contracts).sort(),['admitResourceManifest','buildResourceManifest','evaluateResourceBuildKeys','getResourceManifestIdentityInputs','isAdmittedResourceManifest','serializeResourceManifest','validateResourceBuildDescription','validateResourceBuildPlanDescription'].sort());
 assert.deepEqual(Object.keys(project).sort(),['describeResourceBuild','parseResourceManifest','serializeResourceManifest','describeContentRecipes','bindContentArtifacts','createContentAdoption'].sort());
 const rootProject=await import('@egret/project');assert.equal(Object.keys(rootProject).length,6);
 const rootContracts=await import('@egret/contracts');assert.equal(Object.hasOwn(rootContracts,'buildResourceManifest'),false);
});

// Break caught: canonical property selection/order, UTF-8 or either hash is wrong.
test('literal build and runtime identity inputs agree with independent native crypto',async()=>{
 const manifest=build(),actual=manifest.entries[0],expectedKey=sha(BUILD_INPUT_A),runtime=runtimeInputA(expectedKey);
 assert.deepEqual(contracts.getResourceManifestIdentityInputs(manifest,'e_a'),{build:BUILD_INPUT_A,runtime});
 assert.equal(actual.buildKey,expectedKey);assert.equal(actual.runtimeIdentity,sha(runtime));
 const native=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(BUILD_INPUT_A));
 assert.equal(Buffer.from(native).toString('hex'),actual.buildKey);
 frozen(manifest);assert.equal(contracts.isAdmittedResourceManifest(manifest),true);
});

// Break caught: a structural copy steals the admission brand or getters run first.
test('counterfeit manifests have no brand and cannot be serialized or inspected',()=>{
 const original=build(),copy=clone(original);assert.equal(contracts.isAdmittedResourceManifest(copy),false);
 let reads=0;const hostile={get entries(){reads++;throw Error('getter executed');}};
 assert.equal(contracts.isAdmittedResourceManifest(hostile),false);refuse(contracts.serializeResourceManifest(hostile));
 assert.throws(()=>contracts.getResourceManifestIdentityInputs(hostile,'e_a'),TypeError);assert.equal(reads,0);
 assert.throws(()=>contracts.getResourceManifestIdentityInputs(original,'e_absent'),RangeError);
});

// Break caught: the project adapter independently brands or skips claimed-key checks.
test('project parse and serialize use the sole contracts admission authority',()=>{
 const original=build(),canonical=ok(contracts.serializeResourceManifest(original));
 const parsed=ok(project.parseResourceManifest(canonical));assert.equal(contracts.isAdmittedResourceManifest(parsed),true);
 assert.equal(ok(project.serializeResourceManifest(parsed)),canonical);assert.equal(ok(contracts.serializeResourceManifest(parsed)),canonical);
 const bad=JSON.parse(canonical);bad.entries[0].buildKey='0'.repeat(64);refuse(project.parseResourceManifest(JSON.stringify(bad)));
});

// Break caught: claimed hashes can override recomputation.
test('claimed build and runtime identity tampering both refuse admission',()=>{
 for(const field of ['buildKey','runtimeIdentity']){const bad=wire();bad.entries[0][field]='0'.repeat(64);refuse(contracts.admitResourceManifest(bad));}
 const bad=wire();bad.entries[0].settings.alpha=2;refuse(contracts.admitResourceManifest(bad));
});

// Break caught: output bytes enter a self-referential build key or are omitted from identity.
test('changed artifact preserves build key but creates a different runtime identity',()=>{
 const original=build(),changed=description();changed.entries[0].artifact.sha256=ABC_SHA256;changed.entries[0].artifact.byteLength=3;
 const next=build(changed);assert.equal(next.entries[0].buildKey,original.entries[0].buildKey);assert.notEqual(next.entries[0].runtimeIdentity,original.entries[0].runtimeIdentity);
 const forged=wire(original);forged.entries[0].artifact.sha256=ABC_SHA256;forged.entries[0].artifact.byteLength=3;refuse(contracts.admitResourceManifest(forged));
});

// Break caught: path/enumeration changes accidentally change semantic identity.
test('file enumeration, object insertion and resource enumeration do not change canonical output',()=>{
 const first=description([entry('e_b',['e_a']),entry('e_a')]),second=clone(first);second.entries.reverse();second.entries[0].settings={zeta:'雪',alpha:1};
 assert.equal(ok(contracts.serializeResourceManifest(build(first))),ok(contracts.serializeResourceManifest(build(second))));
 const changed=clone(first);for(const item of changed.entries){item.source.path='relocated/source.txt';item.artifact.path='relocated/artifact.txt';}
 const before=byId(build(first)),after=byId(build(changed));for(const id of ['e_a','e_b']){assert.equal(after[id].buildKey,before[id].buildKey);assert.equal(after[id].runtimeIdentity,before[id].runtimeIdentity);}
 const a=snapshot(first.entries),b=clone(a);b.files.reverse();b.entities.reverse();
 assert.equal(ok(contracts.serializeResourceManifest(build(ok(project.describeResourceBuild(ok(parseProjectSnapshot(JSON.stringify(a))),'web-shared/1'))))),ok(contracts.serializeResourceManifest(build(ok(project.describeResourceBuild(ok(parseProjectSnapshot(JSON.stringify(b))),'web-shared/1'))))));
});

// Break caught: project/logical identity is absent from runtime identity or leaks into build identity.
test('project and logical identity partition runtime refs without changing build inputs',()=>{
 const original=build(),other=description();other.projectId='p_other';other.entries[0].id='e_other';const changed=build(other);
 assert.equal(original.entries[0].buildKey,changed.entries[0].buildKey);assert.notEqual(original.entries[0].runtimeIdentity,changed.entries[0].runtimeIdentity);
});

// Break caught: declared bytes are misleadingly treated as verified file contents.
test('metadata admission alone accepts self-consistent declarations without a byte claim',()=>{
 const claimed=description();claimed.entries[0].source.sha256='a'.repeat(64);claimed.entries[0].source.byteLength=999;
 const manifest=build(claimed);assert.equal(manifest.entries[0].source.byteLength,999);
 assert.equal(Object.hasOwn(manifest,'bytesVerified'),false);assert.equal(Object.hasOwn(manifest,'manifestSha256'),false);
});

// Break caught: settings/importer/version/target/provenance/source changes fail to invalidate dependants.
test('build-affecting inputs invalidate exactly their dependent closure',()=>{
 const base=description([entry('e_a'),entry('e_b',['e_a']),entry('e_c')]);for(const item of base.entries){const suffix=item.id.slice(2);item.source.id='f_source_'+suffix;item.source.path='sources/'+suffix+'.txt';item.artifact.id='f_artifact_'+suffix;item.artifact.path='assets/'+suffix+'.txt';}const before=byId(build(base));
 const mutations=[e=>{e.resourceKind='image';},e=>{e.source.sha256='1'.repeat(64);},e=>{e.source.byteLength=4;},e=>{e.importer.id='other';},e=>{e.importer.version='2.0.0';},e=>{e.settings.alpha=2;},e=>{e.artifactFormatVersion='text/2';},e=>{e.provenance.origin='independent-first-party';}];
 for(const mutate of mutations){const next=clone(base);mutate(next.entries[0]);const after=byId(build(next));assert.notEqual(after.e_a.buildKey,before.e_a.buildKey);assert.notEqual(after.e_b.buildKey,before.e_b.buildKey);assert.equal(after.e_c.buildKey,before.e_c.buildKey);}
 for(const mutate of [d=>{d.versions.engineVersion='0.0.1';},d=>{d.versions.resourceFormatVersion='1.1';},d=>{d.targetProfile='web-shared/2';d.entries.forEach(e=>{e.targetProfile=d.targetProfile;});}]){const next=clone(base);mutate(next);assert.notEqual(byId(build(next)).e_a.buildKey,before.e_a.buildKey);}
});

// Break caught: dependency identities are sorted/lost or recursion follows input order.
test('dependency order is semantic while topology is independent of entry order',()=>{
 const a=description([entry('e_c',['e_b','e_a']),entry('e_b'),entry('e_a')]),b=clone(a);b.entries[0].dependencies.reverse();
 const first=byId(build(a)),second=byId(build(b));assert.notEqual(first.e_c.buildKey,second.e_c.buildKey);assert.equal(first.e_a.buildKey,second.e_a.buildKey);
 const inputs=contracts.getResourceManifestIdentityInputs(build(a),'e_c').build;
 const expected='"dependencies":[{"buildKey":"'+first.e_b.buildKey+'","id":"e_b"},{"buildKey":"'+first.e_a.buildKey+'","id":"e_a"}]';assert.ok(inputs.includes(expected));
});

// Break caught: graph admission permits missing edges, cycles, repeats or target mismatch.
test('invalid dependency graphs and duplicate identities refuse before manifest creation',()=>{
 const bad=[description([entry('e_a',['e_absent'])]),description([entry('e_a',['e_a'])]),description([entry('e_a',['e_b']),entry('e_b',['e_a'])]),description([entry('e_a'),entry('e_a')]),description([entry('e_a'),entry('e_b',['e_a','e_a'])])];
 const wrong=description();wrong.entries[0].targetProfile='other';bad.push(wrong);
 for(const value of bad)refuse(api().buildResourceManifest(value));
});

// Break caught: a shared file ID can describe inconsistent bytes or different IDs alias a path.
test('file identity disagreements and path collisions refuse',()=>{
 const same=description([entry('e_a'),entry('e_b')]);same.entries[1].source.sha256='2'.repeat(64);refuse(api().buildResourceManifest(same));
 const alias=description([entry('e_a'),entry('e_b')]);alias.entries[1].source.id='f_other';alias.entries[1].source.path='SOURCES/a.txt';refuse(contracts.buildResourceManifest(alias));
});

// Break caught: source data IDs and explicit typed references disagree unnoticed.
test('project resource data and explicit references must agree exactly',()=>{
 api();const valid=snapshot([entry('e_a'),entry('e_b',['e_a'])]);
 const described=ok(project.describeResourceBuild(ok(parseProjectSnapshot(JSON.stringify(valid))),'web-shared/1'));
 assert.equal(described.format,'egret.resource-build/1');assert.equal(described.entries.length,2);assert.equal(Object.hasOwn(described.entries[0],'buildKey'),false);frozen(described);
 const changes=[s=>{s.entities[1].references.pop();},s=>{s.entities[1].references[2].slot='dependency:9';},s=>{s.entities[0].data.sourceFileId='f_artifact';},s=>{s.entities[0].references.push({slot:'extra',target:'file',id:'f_source',expectedRole:'source'});},s=>{s.entities[0].dataSchemaVersion='2';},s=>{s.entities[0].data.targetProfile='other';}];
 for(const change of changes){const bad=clone(valid);change(bad);refuse(project.describeResourceBuild(ok(parseProjectSnapshot(JSON.stringify(bad))),'web-shared/1'));}
 const numeric=clone(valid);numeric.entities[0].dataSchemaVersion=1;refuse(project.describeResourceBuild(numeric,'web-shared/1'));
});

// Break caught: adapter trusts hostile or unvalidated snapshot structures.
test('project adapter revalidates a parsed copy without evaluating snapshot accessors',()=>{
 api();let reads=0;const bad=snapshot();Object.defineProperty(bad,'entities',{enumerable:true,get(){reads++;throw Error('getter');}});
 refuse(project.describeResourceBuild(bad,'web-shared/1'));assert.equal(reads,0);
 const raw=snapshot();const valid=ok(project.describeResourceBuild(raw,'web-shared/1'));raw.entities[0].data.settings.alpha=4;assert.equal(valid.entries[0].settings.alpha,1);
});

// Break caught: imported JSON silently collapses duplicate keys or unsafe integer tokens.
test('project manifest parsing retains strict JSON, Unicode and integer checks',()=>{
 const text=ok(api().serializeResourceManifest(build()));
 for(const bad of [text.replace('"projectId":"p_demo"','"projectId":"p_demo","projectId":"p_other"'),text.replace('"byteLength":3','"byteLength":3.0000000000000000001'),text.replace('"byteLength":3','"byteLength":-0'),text.replace('"zeta":"雪"','"zeta":"\\ud800"'),'/* comment */'+text,text.replace(/}$/,',}')])refuse(project.parseResourceManifest(bad));
});

// Break caught: unsupported metadata silently receives defaults or unknown fields are ignored.
test('unsupported formats and malformed scalar fields refuse without defaults',()=>{
 const changes=[d=>{d.format='egret.resource-build/2';},d=>{d.versions.toolProtocolVersion='2.0';},d=>{delete d.versions.engineVersion;},d=>{d.extra=true;},d=>{d.entries[0].extra=true;},d=>{d.entries[0].source.sha256='A'.repeat(64);},d=>{d.entries[0].source.byteLength=1.5;},d=>{d.entries[0].source.byteLength=-0;},d=>{d.entries[0].settings.alpha=Infinity;},d=>{d.entries[0].settings.alpha=NaN;},d=>{d.entries[0].settings.alpha=undefined;},d=>{d.entries[0].id='';},d=>{d.projectId='https://example.test/project';},d=>{d.entries[0].settings.zeta='\ud800';}];
 for(const change of changes){const bad=description();change(bad);refuse(api().buildResourceManifest(bad));}
});

// Break caught: resolving a path can escape its owner or introduce URL/case aliases.
test('portable logical paths reject escapes, URL encodings and device names',()=>{
 for(const path of ['../a','/a','C:/a','a\\b','a//b','./a','a/../b','a/.','a.','a ','CON.txt','a/NUL','https://example.test/a','a?x=1','a#fragment','%2e%2e/a','a/%2F/b']){const bad=description();bad.entries[0].artifact.path=path;refuse(api().buildResourceManifest(bad));}
});

// Break caught: descriptor traversal invokes accessors or admits mutable exotic data.
test('accessors, exotic objects, sparse arrays, symbol keys and cyclic JSON refuse safely',()=>{
 api();let reads=0;const accessor=description();Object.defineProperty(accessor.entries[0].settings,'trap',{enumerable:true,get(){reads++;return 1;}});
 const exotic=description();exotic.entries[0].settings=new Date();const sparse=description();sparse.entries=new Array(1);
 const symbol=description();symbol.entries[0].settings[Symbol('key')]=1;const cyclic=description();cyclic.entries[0].settings.self=cyclic.entries[0].settings;
 const nonenumerable=description();Object.defineProperty(nonenumerable.entries[0].settings,'hidden',{value:1});
 const inherited=description();inherited.entries[0].settings=Object.create({inherited:1});
 const arrayExtra=description();arrayExtra.entries.extra=true;
 for(const bad of [accessor,exotic,sparse,symbol,cyclic,nonenumerable,inherited,arrayExtra])refuse(contracts.buildResourceManifest(bad));assert.equal(reads,0);
 const hostile=new Proxy({}, {getPrototypeOf(){throw Error('trap');}});refuse(contracts.admitResourceManifest(hostile));
 const revocable=Proxy.revocable({},{});revocable.revoke();refuse(contracts.admitResourceManifest(revocable.proxy));
});

// Break caught: admission retains caller-owned settings/dependency objects.
test('successful admission copies every mutable input before branding',()=>{
 const input=description(),manifest=build(input);input.entries[0].settings.alpha=9;input.entries[0].dependencies.push('e_absent');input.versions.engineVersion='9';
 assert.equal(manifest.entries[0].settings.alpha,1);assert.deepEqual(manifest.entries[0].dependencies,[]);assert.equal(manifest.versions.engineVersion,'0.0.0');
});

// Break caught: resource, edge or longest-path ceilings have off-by-one errors.
test('resource and dependency graph boundaries admit their limit and reject excess',()=>{
 const resources=Array.from({length:4096},(_,i)=>entry('e_'+i));assert.equal(build(description(resources)).entries.length,4096);refuse(contracts.buildResourceManifest(description([...resources,entry('e_over')])));
 const chain=count=>Array.from({length:count},(_,i)=>entry('e_'+i,i?['e_'+(i-1)]:[]));build(description(chain(32)));refuse(contracts.buildResourceManifest(description(chain(33))));
 const leaves=Array.from({length:128},(_,i)=>entry('e_l'+i));const parents=Array.from({length:64},(_,i)=>entry('e_p'+i,leaves.map(x=>x.id)));build(description([...leaves,...parents]));
 const overflow=entry('e_over',['e_l0']);refuse(contracts.buildResourceManifest(description([...leaves,...parents,overflow])));
});

// Break caught: the settings byte cap uses UTF-16 units or excludes JSON overhead.
test('settings canonical UTF-8 byte limit includes syntax and multibyte characters',()=>{
 const exact=description();exact.entries[0].settings={text:'x'.repeat(65525)};build(exact);
 const tooLarge=clone(exact);tooLarge.entries[0].settings.text+='x';refuse(contracts.buildResourceManifest(tooLarge));
 const unicode=description();unicode.entries[0].settings={text:'雪'.repeat(21842)};refuse(contracts.buildResourceManifest(unicode));
});

// Break caught: whole manifest raw/canonical size admission is absent.
test('manifest four MiB ceiling applies before text or metadata admission',()=>{
 api();refuse(project.parseResourceManifest(' '.repeat(4194305)));
 const many=Array.from({length:70},(_,i)=>{const value=entry('e_'+i);value.settings={text:'x'.repeat(60000)};return value;});refuse(contracts.buildResourceManifest(description(many)));
});

function filesystemFixture(action){
 const parent=realpathSync(tmpdir()),dir=mkdtempSync(path.join(parent,'egret-resource-manifest-'));mkdirSync(path.join(dir,'sources'));mkdirSync(path.join(dir,'assets'));
 writeFileSync(path.join(dir,'sources/a.txt'),'abc');writeFileSync(path.join(dir,'assets/a.txt'),'');
 const input=path.join(dir,'project.json'),output=path.join(dir,'manifest.json'),receipt=path.join(dir,'receipt.json');writeFileSync(input,JSON.stringify(snapshot()));
 try{return action({dir,input,output,receipt});}finally{const actual=realpathSync(dir),relative=path.relative(parent,actual);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(actual).startsWith('egret-resource-manifest-'));rmSync(actual,{recursive:true,force:true});}
}
function runBuilder(f){const tool=path.join(root,'tools/build-resource-manifest.mjs');assert.equal(existsSync(tool),true,'M1.5 actual-byte builder is absent');return spawnSync(process.execPath,[tool,'--project',f.input,'--root',f.dir,'--target','web-shared/1','--out',f.output,'--receipt',f.receipt],{cwd:root,encoding:'utf8'});}

// Break caught: the builder declares metadata-only output to be verified bytes.
test('Node builder verifies exact bytes, produces canonical output and separate source receipt',()=>filesystemFixture(f=>{
 api();const run=runBuilder(f);assert.equal(run.status,0,run.stdout+run.stderr);const text=readFileSync(f.output,'utf8'),manifest=ok(project.parseResourceManifest(text)),receipt=JSON.parse(readFileSync(f.receipt,'utf8'));
 assert.equal(text,ok(project.serializeResourceManifest(manifest))+'\n');assert.equal(receipt.format,'egret.resource-build-receipt/1');assert.equal(receipt.manifest.sha256,sha(text));assert.equal(receipt.manifest.byteLength,Buffer.byteLength(text));
 assert.deepEqual(receipt.files.map(item=>({id:item.id,path:item.path,sha256:item.sha256,byteLength:item.byteLength})),[{id:'f_artifact',path:'assets/a.txt',sha256:EMPTY_SHA256,byteLength:0},{id:'f_source',path:'sources/a.txt',sha256:ABC_SHA256,byteLength:3}]);
 const again=runBuilder({...f,output:path.join(f.dir,'manifest2.json'),receipt:path.join(f.dir,'receipt2.json')});assert.equal(again.status,0,again.stdout+again.stderr);assert.equal(readFileSync(path.join(f.dir,'manifest2.json'),'utf8'),text);
}));

// Break caught: one bad source/artifact is ignored, or failure overwrites prior evidence.
test('Node builder refuses source and artifact byte mismatches before writing outputs',()=>{
 for(const kind of ['source','artifact'])filesystemFixture(f=>{api();writeFileSync(path.join(f.dir,kind==='source'?'sources/a.txt':'assets/a.txt'),kind==='source'?'abd':'x');writeFileSync(f.output,'preserved output\n');writeFileSync(f.receipt,'preserved receipt\n');const run=runBuilder(f);assert.notEqual(run.status,0);assert.match(run.stderr,/byte|hash|digest|length/i);assert.equal(readFileSync(f.output,'utf8'),'preserved output\n');assert.equal(readFileSync(f.receipt,'utf8'),'preserved receipt\n');});
});

// Break caught: integer-looking object keys use JSON enumeration instead of lexical canonical order.
test('canonical settings sort numeric-looking and nested keys by UTF-16 code units',()=>{
 const input=description();input.entries[0].settings={'2':false,'10':true,nested:{z:1,a:2}};
 const manifest=build(input),expected=BUILD_INPUT_A.replace('"settings":{"alpha":1,"zeta":"雪"}','"settings":{"10":true,"2":false,"nested":{"a":2,"z":1}}');
 assert.equal(contracts.getResourceManifestIdentityInputs(manifest,'e_a').build,expected);assert.equal(manifest.entries[0].buildKey,sha(expected));
});

// Break caught: target selection rejects valid mixed projects or silently accepts an absent target.
test('project description selects exactly one target and distinguishes absent from no resources',()=>{
 api();const wanted=entry('e_a'),other=entry('e_b');other.targetProfile='other/1';const raw=snapshot([wanted,other]);
 const selected=ok(project.describeResourceBuild(ok(parseProjectSnapshot(JSON.stringify(raw))),'web-shared/1'));assert.deepEqual(selected.entries.map(x=>x.id),['e_a']);
 refuse(project.describeResourceBuild(raw,'absent/1'));
 const empty=snapshot([]);empty.files=[];const none=ok(project.describeResourceBuild(empty,'web-shared/1'));assert.deepEqual(none.entries,[]);assert.deepEqual(build(none).entries,[]);
 const unrelated=snapshot([]);unrelated.entities=[{id:'e_scene',kind:'example.scene',dataSchemaVersion:'1',name:'',data:{},references:[]}];unrelated.roots=['e_scene'];assert.deepEqual(ok(project.describeResourceBuild(unrelated,'web-shared/1')).entries,[]);
});

// Break caught: a shallow first visit hides a longer path to an already visited shared dependency.
test('joined dependency DAG measures the longest path through shared descendants',()=>{
 const joined=length=>{const leaf=entry('e_leaf'),chain=Array.from({length},(_,i)=>entry('e_chain'+i,[i?'e_chain'+(i-1):'e_leaf']));return description([entry('e_root',['e_leaf','e_chain'+(length-1)]),leaf,...chain.reverse()]);};
 assert.equal(build(joined(30)).entries.length,32);refuse(contracts.buildResourceManifest(joined(31)));
});

// Break caught: valid builds clobber earlier output/receipt evidence or alias the two outputs.
test('Node builder never overwrites existing output or receipt on valid inputs',()=>{
 for(const which of ['output','receipt'])filesystemFixture(f=>{api();writeFileSync(f[which],'preserved evidence\n');const run=runBuilder(f);assert.notEqual(run.status,0);assert.equal(readFileSync(f[which],'utf8'),'preserved evidence\n');assert.equal(existsSync(f[which==='output'?'receipt':'output']),false);});
 filesystemFixture(f=>{api();const run=runBuilder({...f,receipt:f.output});assert.notEqual(run.status,0);assert.equal(existsSync(f.output),false);});
});

// Break caught: description validation manufactures a manifest or skips graph admission.
test('shared description authority copies and validates metadata without build keys or manifest brand',()=>{
 api();assert.equal(typeof contracts.validateResourceBuildDescription,'function');
 const raw=description(),value=ok(contracts.validateResourceBuildDescription(raw));frozen(value);assert.equal(contracts.isAdmittedResourceManifest(value),false);
 assert.equal(value.format,'egret.resource-build/1');assert.equal(Object.hasOwn(value.entries[0],'buildKey'),false);assert.equal(Object.hasOwn(value.entries[0],'runtimeIdentity'),false);
 raw.entries[0].settings.alpha=7;assert.equal(value.entries[0].settings.alpha,1);
 refuse(contracts.validateResourceBuildDescription(description([entry('e_a',['e_absent'])])));refuse(contracts.validateResourceBuildDescription(description([entry('e_a',['e_a'])])));
});
