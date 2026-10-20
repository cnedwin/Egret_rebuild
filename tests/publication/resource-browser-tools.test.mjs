// SPDX-License-Identifier: Apache-2.0
// Controls for the current resource-family adapter; native evidence is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const target=new URL('../../tools/browser-resources.mjs',import.meta.url);
async function api(){assert.ok(fs.existsSync(target),'Current resource-family entry must exist');return import(target.href);}
test('resource families have complete fixed schedules, including importer cases',async()=>{
 const {resourceCases}=await api();
 assert.deepEqual(resourceCases('prepared-groups').map(x=>[x.profile,x.kind]),['canvas-2d','webgpu-scene-textured'].flatMap(p=>['ordinary','manual-old-A-outer','manual-old-B-trim'].map(k=>[p,k])));
 assert.equal(resourceCases('atlas').length,8);
 assert.equal(resourceCases('atlas').filter(x=>x.kind==='atlas-import-v1').length,2);
 assert.throws(()=>resourceCases('unknown'));
});
test('resource command requires exact options and explicit reviewed digest',async()=>{
 const {parseResourceOptions}=await api();
 assert.equal(parseResourceOptions(['run','--manifest',path.resolve('manifest.json'),'--sha256','a'.repeat(64)]).sha256,'a'.repeat(64));
 assert.throws(()=>parseResourceOptions(['run','--manifest','relative.json','--sha256','a'.repeat(64)]));
 assert.throws(()=>parseResourceOptions(['run','--manifest',path.resolve('manifest.json')]));
 assert.throws(()=>parseResourceOptions(['prepare','--suite','atlas','--playwright',path.resolve('pw'),'--output',path.resolve('out'),'--kind','ordinary']));
 assert.throws(()=>parseResourceOptions(['prepare','--suite','png','--playwright',path.resolve('pw'),'--output',path.resolve('out')]));
});
test('resource manifest refuses missing cases or changes before any child runs',async()=>{
 const {validateResourceManifest}=await api();
 const base={schemaVersion:1,status:'PREPARED_REVIEW_REQUIRED',reviewed:false,browserRun:false,repository:fileURLToPath(new URL('../..',import.meta.url))};
 assert.throws(()=>validateResourceManifest({...base,suite:'atlas',cases:[]}),/schedule/i);
 assert.throws(()=>validateResourceManifest({...base,suite:'prepared-groups',cases:[{profile:'canvas-2d',kind:'ordinary'}]}),/schedule/i);
});
test('resource completion refuses a success label without controls and retirement',async()=>{
 const {validateResourceCompletion}=await api();
 for(const suite of ['prepared-groups','atlas','png'])assert.throws(()=>validateResourceCompletion(suite,{profile:'canvas-2d',kind:'ordinary'},{status:'PASS'}),/receipt|completion/i);
 const good={status:'PASS',environment:{node:'v26.7.0',browserVersion:'test',playwrightVersion:'1.62.1'},nativeScenario:{profile:'canvas-2d',kind:'ordinary'},nativeAcceptance:'FINITE_NATIVE_SEQUENCE_PASS',ordinaryAccepted:true,failures:[],retirementFailures:[],pendingOriginalTasks:0,rawFrames:Array.from({length:17},()=>({status:'COMPARISON_SAVED'})),fixtureResult:{cases:[{ok:true},{ok:true}]},acquiredOwners:['server','browser'],retired:{server:true,browser:true}};
 validateResourceCompletion('prepared-groups',{profile:'canvas-2d',kind:'ordinary'},good);
 for(const patch of [{pendingOriginalTasks:1},{fixtureResult:{cases:[{ok:true}]}},{rawFrames:[]},{rawFrames:good.rawFrames.slice(1)},{retired:{server:true,browser:false}}])assert.throws(()=>validateResourceCompletion('prepared-groups',{profile:'canvas-2d',kind:'ordinary'},{...good,...patch}));
});

test('atlas copied collector dependencies cannot drift behind a pinned entry',async()=>{
 const {verifyAtlasCollectorCopy}=await api();
 assert.equal(typeof verifyAtlasCollectorCopy,'function');
 const root=fileURLToPath(new URL('../..',import.meta.url));
 const owner=fs.mkdtempSync(path.join(os.tmpdir(),'egret-atlas-copy-'));
 try{
  for(const key of ['tools/verify-atlas-frame.mjs','tools/atlas-frame/boundary.mjs','tools/atlas-frame/scenario.mjs','tools/lib/file-identity.mjs']){fs.mkdirSync(path.dirname(path.join(owner,key)),{recursive:true});fs.copyFileSync(path.join(root,key),path.join(owner,key));}
  verifyAtlasCollectorCopy(owner,'ordinary');
  fs.appendFileSync(path.join(owner,'tools/atlas-frame/boundary.mjs'),'\n// altered\n');
  assert.throws(()=>verifyAtlasCollectorCopy(owner,'ordinary'),/Copied collector/);
 }finally{fs.rmSync(owner,{recursive:true,force:true});}
});


test('reviewed case bytes are rechecked even when rewritten JSON has equal meaning',async()=>{
 const {verifyResourceCasePins}=await api();
 assert.equal(typeof verifyResourceCasePins,'function');
 const {createHash}=await import('node:crypto');
 const owner=fs.mkdtempSync(path.join(os.tmpdir(),'egret-case-pin-'));
 const file=path.join(owner,'input.json'),original=Buffer.from('{"value":1}');
 fs.writeFileSync(file,original);
 const pin={path:file,bytes:original.length,sha256:createHash('sha256').update(original).digest('hex')};
 try{
  for(const suite of ['prepared-groups','atlas','png']){
   const row={config:pin,snapshot:pin,preparation:pin,admission:pin};
   verifyResourceCasePins(suite,row);
   fs.writeFileSync(file,'{ "value": 1 }');
   assert.throws(()=>verifyResourceCasePins(suite,row),/Raw input drift/);
   fs.writeFileSync(file,original);
  }
  // The fingerprint helper uses its imported reader; this intercepts the later adapter read only.
  const read=fs.readFileSync;
  try{fs.readFileSync=function(target,...args){if(target===file)return Buffer.from('{"value":2}');return read.call(this,target,...args);};
   assert.throws(()=>verifyResourceCasePins('png',{admission:pin}),/Raw input drift/);
  }finally{fs.readFileSync=read;}
 }finally{fs.rmSync(owner,{recursive:true,force:true});}
});


test('PNG graph admits the current hoisted owner and rejects old or foreign owners',async()=>{
 const {verifyBrowserPngDependencyOwner}=await import('../../tools/browser-png/file-graph.mjs');
 assert.equal(typeof verifyBrowserPngDependencyOwner,'function');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret-png-owner-'));
 try{
  for(const relative of ['node_modules/robust-predicates','node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates','foreign/node_modules/robust-predicates'])fs.mkdirSync(path.join(root,relative),{recursive:true});
  assert.equal(verifyBrowserPngDependencyOwner(root,path.join(root,'node_modules/robust-predicates')),'node_modules/robust-predicates');
  for(const relative of ['node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates','foreign/node_modules/robust-predicates'])assert.throws(()=>verifyBrowserPngDependencyOwner(root,path.join(root,relative)),/DEPENDENCY_OWNER/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test('five literal PNG scenes require explicit evidence and retain their exact suite identity',async()=>{
 const {resourceCases,parseResourceOptions,verifyResourceCasePins}=await api();
 for(const suite of ['nine-slice-bitmap','display-container-remove-children','display-container-child-index','display-container-add-child-at','display-anchor-offsets']){
  assert.deepEqual(resourceCases(suite),[{profile:suite,kind:'ordinary'}]);
  const args=['prepare','--suite',suite,'--playwright',path.resolve('pw'),'--output',path.resolve('out')];
  assert.throws(()=>parseResourceOptions(args),/Exact options/);
  assert.equal(parseResourceOptions([...args,'--evidence',path.resolve('evidence.json'),'--evidence-sha256','a'.repeat(64)]).suite,suite);
  assert.throws(()=>verifyResourceCasePins(suite,{admission:{path:path.resolve('absent-review.json'),bytes:0,sha256:'a'.repeat(64)}}));
 }
});

test('literal scene receipts cannot borrow BIP1 credit or omit a control or retirement',async()=>{
 const {validateResourceCompletion}=await api();
 for(const suite of ['nine-slice-bitmap','display-container-remove-children','display-container-child-index','display-container-add-child-at','display-anchor-offsets']){
  const nine=suite==='nine-slice-bitmap',control=['display-container-add-child-at','display-anchor-offsets'].includes(suite),backends=nine?['webgpu']:['canvas','webgpu'],renders=nine?3:control?10:6;
  const retirement={backend:'canvas',mode:suite==='display-anchor-offsets'?'wrong-pivot-control':'wrong-index-control',primaryOccurred:false,cleanupErrors:[],pendingTickets:0,tickets:[{settled:true,fulfilled:true}],newCaptures:2,savedReplays:0,scopeState:'closed',allSceneNodesDisposed:true,diagnostics:[],ports:[{renderSubmissions:2,close:'fulfilled',safeHostReturn:true,engineDisposeFulfilled:true,quarantine:false}]};
  const receipt={status:'PASS',profile:suite,node:{version:'v26.7.0'},browserVersion:'test',primaryOccurred:false,cleanupErrors:[],pendingTicketIds:[],beforeAfterGraphStable:true,sourceAndInstalledRuntimePinsStable:true,browserCloseFulfilled:true,serverCloseFulfilled:true,contextRetirement:backends.map(backend=>({backend,closeFulfilled:true})),renderedSubmissions:renders,completeRawReadbacks:renders,newCaptures:renders-backends.length,savedReplays:backends.length,pixelsCompared:renders*576,channelsCompared:renders*2304,actualNativeMainCases:backends.length,actualNativeMainPasses:backends.length,positiveCanvasSubmissions:nine?0:renders/2,...(nine?{canvasRefusalCases:2}:{}),...(control?{actualNegativeControlCases:1,actualNegativeControlPasses:1,additionalControlSubmissions:2,additionalControlReadbacks:2}:{}),wrongOracleControls:control?[{id:'C1',backend:'canvas',pass:true,baselinePass:true,expected:'literal-mismatch',mismatchedChannels:128,additionalSubmissions:2,additionalReadbacks:2,mainCredit:0,retirement}]:[]};
  validateResourceCompletion(suite,{profile:suite,kind:'ordinary'},receipt);
  for(const patch of [{profile:'browser-png'},{completeRawReadbacks:renders-1},{channelsCompared:0},{actualNativeMainPasses:0},{pendingTicketIds:[1]},{contextRetirement:[]}])assert.throws(()=>validateResourceCompletion(suite,{profile:suite,kind:'ordinary'},{...receipt,...patch}));
  if(nine)for(const patch of [{canvasRefusalCases:1},{positiveCanvasSubmissions:1}])assert.throws(()=>validateResourceCompletion(suite,{profile:suite,kind:'ordinary'},{...receipt,...patch}));
  if(control){
   for(const patch of [{wrongOracleControls:[]},{additionalControlReadbacks:0},{actualNegativeControlPasses:0}])assert.throws(()=>validateResourceCompletion(suite,{profile:suite,kind:'ordinary'},{...receipt,...patch}));
   for(const patch of [{baselinePass:false},{mainCredit:1},{mismatchedChannels:0},{retirement:{...retirement,pendingTickets:1}},{retirement:{...retirement,ports:[{...retirement.ports[0],quarantine:true}]}}])assert.throws(()=>validateResourceCompletion(suite,{profile:suite,kind:'ordinary'},{...receipt,wrongOracleControls:[{...receipt.wrongOracleControls[0],...patch}]}));
  }
 }
});

test('literal scenes preserve the original ESM Playwright entry without widening BIP1',async()=>{
 const {validateResourceRuntime}=await api();assert.equal(typeof validateResourceRuntime,'function');
 const installed=path.resolve('installed-playwright'),node=process.execPath;
 for(const suite of ['png','nine-slice-bitmap','display-container-remove-children','display-container-child-index','display-container-add-child-at','display-anchor-offsets']){
  const entry=suite==='png'?'index.js':'index.mjs';
  const evidence={runtime:{nodeExecutable:{path:node},playwrightEntry:{path:path.join(installed,entry)}}};
  validateResourceRuntime(suite,evidence,installed);
  for(const wrong of [path.join(installed,suite==='png'?'index.mjs':'index.js'),path.resolve('foreign-playwright',entry)])assert.throws(()=>validateResourceRuntime(suite,{runtime:{...evidence.runtime,playwrightEntry:{path:wrong}}},installed),/runtime selection/);
 }
});


// SOURCE controls: synthetic complete owners exercise the real graph reader;
// they do not evaluate product modules or claim native rendering evidence.
async function withPngLazyGraph(run){
 const {freezeBrowserPngGraph}=await import('../../tools/browser-png/file-graph.mjs');
 const {createHash}=await import('node:crypto');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'egret-png-lazy-graph-'));
 const owner=path.join(temporary,'owner');fs.mkdirSync(owner);
 const write=(relative,body)=>{const file=path.join(owner,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
 const pin=file=>{const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const json=(relative,value)=>write(relative,JSON.stringify(value)+'\n');
 const product=(relative,body)=>{
  const emitted='packages/engine/dist/'+relative;
  const source='packages/engine/'+(relative.startsWith('web/')||relative.startsWith('rendering/')?'':'src/')+relative.replace(/\.js$/,'.ts');
  write(emitted,body);write(emitted.replace(/\.js$/,'.d.ts'),'export {};\n');write(source,body);
 };
 try{
  for(const relative of ['pnpm-workspace.yaml','pnpm-lock.yaml','tools/build.mjs','tools/lib/file-identity.mjs'])write(relative,'// source graph fixture\n');
  json('package.json',{private:true,type:'module'});json('tsconfig.json',{});json('tsconfig.base.json',{});
  for(const name of ['contracts','runtime','engine','project']){
   const exports=name==='engine'?Object.fromEntries([['.','index'],['./web','web/index'],['./web/image','web/image'],['./webgpu','web/webgpu']].map(([key,value])=>[key,{import:'./dist/'+value+'.js',types:'./dist/'+value+'.d.ts'}])):{};
   json('packages/'+name+'/package.json',{name:'@egret/'+name,type:'module',exports});
   json('packages/'+name+'/tsconfig.json',{extends:'../../tsconfig.base.json',compilerOptions:{rootDir:'src',outDir:'dist'}});
  }
  for(const part of ['web','rendering'])json('packages/engine/tsconfig.'+part+'.json',{extends:'../../tsconfig.base.json',compilerOptions:{rootDir:part,outDir:'dist/'+part}});
  product('index.js','export const core = true;\n');
  product('web/index.js','export const canvas = true;\n');
  product('web/image.js','export const image = true;\n');
  product('web/webgpu.js',"export { createWebGPUHost } from './WebGPUHost.js';\n");
  product('web/WebGPUHost.js',"export { other } from './OtherHost.js';\nexport function createWebGPUHost() {}\nexport const scene = () => import('./b1.js');\nexport const sharedScene = () => import('./sharedB1.js');\n");
  product('web/OtherHost.js','export const other = true;\n');
  product('web/b1.js',"export { scene } from '../rendering/sceneSupport.js';\n");
  product('web/sharedB1.js',"export { shared } from '../rendering/sharedSceneSupport.js';\n");
  product('rendering/sceneSupport.js','export const scene = true;\n');
  product('rendering/sharedSceneSupport.js','export const shared = true;\n');
  write('tools/browser-png/fixture.mjs',"import '@egret/engine';\nimport '@egret/engine/web/image';\nimport './native-observer.mjs';\n");
  write('tools/browser-png/native-observer.mjs','export const observer = true;\n');
  const fixturePins=['a','b'].map((name,index)=>{const file=path.join(temporary,name+'.png');fs.writeFileSync(file,Buffer.from([137,80,78,71,13,10,26,10,index]));return {...pin(file),route:'/original-'+name+'.png'};});
  const schedule=path.join(temporary,'schedule.json');fs.writeFileSync(schedule,JSON.stringify({backends:['canvas','webgpu'],fixtures:fixturePins.map(({route,bytes,sha256})=>({route,bytes,sha256}))}));
  const input={repositoryRoot:owner,collectorFiles:[{path:'tools/browser-png/fixture.mjs',role:'fixture',route:'/fixture.mjs'},{path:'tools/browser-png/native-observer.mjs',role:'native-observer',route:'/native-observer.mjs'}],fixturePins,schedulePin:pin(schedule)};
  await run({owner,pin,graph:()=>freezeBrowserPngGraph(input)});
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}

function assertPngLazyClosure(graph,owner,pin){
 const host='/packages/engine/dist/web/WebGPUHost.js';
 assert.deepEqual(graph.importEdges.filter(row=>row.kind==='dynamic-literal').map(({from,specifier,to})=>({from,specifier,to})),[
  {from:host,specifier:'./b1.js',to:'/packages/engine/dist/web/b1.js'},
  {from:host,specifier:'./sharedB1.js',to:'/packages/engine/dist/web/sharedB1.js'},
 ]);
 const canvas=graph.backendClosures.find(row=>row.backend==='canvas').moduleRoutes;
 const webgpu=graph.backendClosures.find(row=>row.backend==='webgpu').moduleRoutes;
 for(const [entry,leaf] of [['web/b1.js','rendering/sceneSupport.js'],['web/sharedB1.js','rendering/sharedSceneSupport.js']]){
  const route='/packages/engine/dist/'+entry,target='/packages/engine/dist/'+leaf;
  assert.ok(graph.importEdges.some(row=>row.from===route&&row.kind==='static'&&row.to===target));
  for(const relative of [entry,leaf]){
   const emitted='packages/engine/dist/'+relative,source='packages/engine/'+relative.replace(/\.js$/,'.ts');
   assert.ok(webgpu.includes('/'+emitted));assert.ok(!canvas.includes('/'+emitted));
   assert.ok(graph.moduleRoutes.some(row=>row.route==='/'+emitted));
   for(const [file,role] of [[emitted,'emitted-module'],[emitted.replace(/\.js$/,'.d.ts'),'declaration'],[source,'source']]){
    const row=graph.filePins.find(value=>value.owner==='repository'&&value.path===file),actual=pin(path.join(owner,file));
    assert.ok(row,file);assert.ok(row.roles.includes(role),file);assert.equal(row.bytes,actual.bytes,file);assert.equal(row.sha256,actual.sha256,file);
   }
  }
 }
}

test('SOURCE PNG graph seals both exact Host lazy branches and their full source closures',async()=>{
 await withPngLazyGraph(({graph,owner,pin})=>assertPngLazyClosure(graph(),owner,pin));
});

for(const [label,importer,specifier] of [
 ['other Host target','packages/engine/dist/web/WebGPUHost.js','../rendering/sharedSceneSupport.js'],
 ['legacy target from another importer','packages/engine/dist/web/OtherHost.js','./b1.js'],
 ['shared target from another importer','packages/engine/dist/web/OtherHost.js','./sharedB1.js'],
])test('SOURCE PNG graph rejects '+label+' after a complete fresh baseline',async()=>{
 await withPngLazyGraph(({graph,owner,pin})=>{
  const baseline=graph();assertPngLazyClosure(baseline,owner,pin);
  const file=path.join(owner,importer),original=fs.readFileSync(file);
  try{
   fs.writeFileSync(file,Buffer.concat([original,Buffer.from('export const unadmitted = () => import('+JSON.stringify(specifier)+');\n')]));
   assert.throws(()=>graph(),error=>error.code==='BIP_GRAPH_DYNAMIC_IMPORT_UNADMITTED'&&error.details.path===importer&&error.details.specifier===specifier);
  }finally{fs.writeFileSync(file,original);}
  assert.deepEqual(graph(),baseline,'Restoration retains the complete original graph');
 });
});

// M15-RESOURCE-READER-IDENTITY-BEGIN
test('both resource native readers select only the reviewed complete boundary bytes', async t => {
 const {runInNewContext}=await import('node:vm');
 const {createHash}=await import('node:crypto');
 const identity=await import('../../tools/lib/file-identity.mjs');
 const repository=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'egret-resource-reader-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const relative='tools/resource-scene-boundary.mjs', original=fs.readFileSync(path.join(repository,relative));
 fs.mkdirSync(path.join(root,'tools'));
 const fixture=path.join(root,relative);fs.writeFileSync(fixture,original);
 for(const [tool,reader,next,selection] of [
  ['verify-resource-scene.mjs','function rawInput(','function newExternal(','const boundary='],
  ['verify-prepared-resource-groups.mjs','function read(','function externalNew(','const collector = '],
 ]){
  const source=fs.readFileSync(path.join(repository,'tools',tool),'utf8');
  const constantsStart=source.indexOf('const hash = '),constantsEnd=source.indexOf(tool==='verify-resource-scene.mjs'?'const args = ':'const argumentsMap = ');
  const readerStart=source.indexOf(reader),readerEnd=source.indexOf(next,readerStart);
  const pinsStart=source.indexOf('const historicalCollectorSource = '),callStart=source.indexOf(selection,pinsStart),callEnd=source.indexOf('\n',callStart);
  assert.ok(constantsStart>=0&&constantsEnd>constantsStart&&readerStart>=0&&readerEnd>readerStart&&pinsStart>=0&&callStart>pinsStart&&callEnd>callStart);
  const code=source.slice(constantsStart,constantsEnd)+source.slice(readerStart,readerEnd)
   +'\n(owner)=>{const repository=owner,applicationRoot=owner;\n'+source.slice(pinsStart,callEnd)
   +'\nreturn '+(tool==='verify-resource-scene.mjs'?'boundary':'collector')+';}';
  const select=runInNewContext(code,{fs,path,process,TextDecoder,createHash,identity},{timeout:1000});
  const healthy=()=>assert.deepEqual(Buffer.from(select(root).raw),original);
  const refusalWithRestoration=(exercise,label)=>{
   const failures=[];
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length===0){try{exercise();}catch(error){failures.push(error);}}
   try{fs.writeFileSync(fixture,original);}catch(error){failures.push(error);}
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length)throw new AggregateError(failures,tool+' '+label+' refusal, restoration and complete baseline');
  };
  const altered=Buffer.from(original);altered[0]^=1;
  refusalWithRestoration(()=>{fs.writeFileSync(fixture,altered);assert.throws(()=>select(root),/Selected raw identity|Selected raw input differs/);},'same-length altered');
  refusalWithRestoration(()=>{fs.appendFileSync(fixture,'\n');assert.throws(()=>select(root),/Selected raw identity|Selected raw input differs/);},'appended');
  refusalWithRestoration(()=>{fs.unlinkSync(fixture);assert.throws(()=>select(root));},'missing');
 }
});
// M15-RESOURCE-READER-IDENTITY-END

// Evaluate only the unchanged scalar reader/gate fragments; no SDK, server or browser is started.
test('M15 font patch native collector records and admits only exact reviewed versions',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=fs.readFileSync(new URL('../../tools/verify-resource-scene.mjs',import.meta.url),'utf8');
 const lines=source.split('\n').filter(line=>line.includes('report.environment.browserVersion=browser.version();'));
 assert.equal(lines.length,1);
 const code='version=>{const report={environment:{}},browser={version:()=>version};const requireThat=(value,message)=>{if(!value)throw new Error(message);};'+lines[0]+';return report.environment.browserVersion;}';
 const select=runInNewContext(code,{},{timeout:1000});
 for(const version of ['155.0.4283.45','155.0.4283.62'])assert.equal(select(version),version);
 for(const version of ['155.0.4283.61','155.0.4283.63','155.0.4283.620','155.0.4283.62 ','156.0.0.0',null])assert.throws(()=>select(version),/Approved fixed-font Edge version differs/);
});
test('M15 font patch readers authenticate exact current oracle bytes before evaluation',async t=>{
 const {runInNewContext}=await import('node:vm');const {createHash}=await import('node:crypto');
 const identity=await import('../../tools/lib/file-identity.mjs');
 const repository=fs.realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'egret-font-oracle-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const relative='tools/prepared-resource-groups/oracle.mjs',original=fs.readFileSync(path.join(repository,relative));
 const fixture=path.join(root,relative);fs.mkdirSync(path.dirname(fixture),{recursive:true});fs.writeFileSync(fixture,original);
 const actualPin={path:fixture,bytes:original.length,sha256:createHash('sha256').update(original).digest('hex')};
 for(const [relativeTool,readerEndAnchor,selectionEndAnchor,resultName] of [
  ['tools/prepared-resource-groups/prepare-native-config.mjs','const preparerRelative=','const fixtureRelative=','oracle'],
  ['tools/verify-prepared-resource-groups.mjs','function externalNew(','// Raw authentication','oracleInput'],
 ]){
  const source=fs.readFileSync(path.join(repository,relativeTool),'utf8');
  const constantStart=source.indexOf('const hash'),constantEnd=source.indexOf('const physical');
  const readerStart=source.indexOf('function read('),readerEnd=source.indexOf(readerEndAnchor,readerStart);
  const selectionStart=source.indexOf("const oracleRelative='"),selectionEnd=source.indexOf(selectionEndAnchor,selectionStart);
  assert.ok(constantStart>=0&&constantEnd>constantStart&&readerStart>=0&&readerEnd>readerStart&&selectionStart>=0&&selectionEnd>selectionStart);
  const code=source.slice(constantStart,constantEnd)+source.slice(readerStart,readerEnd)
   +'\n(repository,pin)=>{const config={oracle:pin};\n'+source.slice(selectionStart,selectionEnd)+'\nreturn '+resultName+';}';
  const select=runInNewContext(code,{fs,path,process,TextDecoder,createHash,identity},{timeout:1000});
  const healthy=()=>assert.deepEqual(Buffer.from(select(root,actualPin).raw),original);
  const refusal=mutate=>{
   const failures=[];
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length===0){try{mutate();assert.throws(()=>select(root,actualPin));}catch(error){failures.push(error);}}
   try{fs.writeFileSync(fixture,original);}catch(error){failures.push(error);}
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length)throw new AggregateError(failures,relativeTool+' oracle refusal, restoration and complete baseline');
  };
  refusal(()=>{const wrong=Buffer.from(original);wrong[0]^=1;fs.writeFileSync(fixture,wrong);});
  refusal(()=>fs.unlinkSync(fixture));
  if(resultName==='oracleInput'){
   const wrong=Buffer.from(original);wrong[0]^=1;
   const failures=[];
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length===0){try{fs.writeFileSync(fixture,wrong);const matchingBadPin={...actualPin,sha256:createHash('sha256').update(wrong).digest('hex')};assert.throws(()=>select(root,matchingBadPin),/oracle config pin differs/);}catch(error){failures.push(error);}}
   try{fs.writeFileSync(fixture,original);}catch(error){failures.push(error);}
   try{healthy();}catch(error){failures.push(error);}
   if(failures.length)throw new AggregateError(failures,relativeTool+' matching bad pin refusal, restoration and complete baseline');
  }
 }
});
