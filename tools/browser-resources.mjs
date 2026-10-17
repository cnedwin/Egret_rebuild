// SPDX-License-Identifier: Apache-2.0
// Current resource-family workflow. Preparation never approves review or launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
import {assertBrowserEnvironment} from './browser-verify.mjs';
import {strictJSON} from './atlas-frame/boundary.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const MATRIX=JSON.parse(fs.readFileSync(new URL('./browser-tool-matrix.json',import.meta.url)));
const SCRIPTS={'prepared-groups':'tools/verify-prepared-resource-groups.mjs',atlas:'tools/verify-atlas-frame.mjs',png:'tools/verify-browser-png.mjs'};
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function resourceCases(suite){
 if(suite==='png')return [{profile:'png',kind:'ordinary'}];
 const profiles=suite==='prepared-groups'?['canvas-2d','webgpu-scene-textured']:suite==='atlas'?['canvas-2d','webgpu-textured-2d']:null;
 requireThat(profiles,'Unknown resource family');
 const kinds=suite==='atlas'?['ordinary','rotation-sign','trim-y-constant','atlas-import-v1']:['ordinary','manual-old-A-outer','manual-old-B-trim'];
 return profiles.flatMap(profile=>kinds.map(kind=>({profile,kind})));
}
export function parseResourceOptions(args){
 const [action,...rest]=args;requireThat(['prepare','run'].includes(action),'Expected prepare or run');
 const options={action};for(let i=0;i<rest.length;i+=2){const key=rest[i];requireThat(/^--[a-z][a-z0-9-]*$/.test(key)&&rest[i+1]&&!Object.hasOwn(options,key.slice(2)),'Unique named options required');options[key.slice(2)]=rest[i+1];}
 const keys=action==='run'?['action','manifest','sha256']:['action','suite','playwright','output',...(options.suite==='png'?['evidence','evidence-sha256']:[])];
 requireThat(equal(Object.keys(options).sort(),keys.sort()),'Exact options required; PNG needs original evidence and digest');
 for(const key of action==='run'?['manifest']:['playwright','output',...(options.suite==='png'?['evidence']:[])])requireThat(path.isAbsolute(options[key]),'Absolute '+key+' required');
 for(const key of ['sha256','evidence-sha256'])if(options[key])requireThat(/^[a-f0-9]{64}$/.test(options[key]),'Lowercase SHA-256 required');
 if(action==='prepare')resourceCases(options.suite);return options;
}
function pin(file){requireThat(path.isAbsolute(file),'Absolute pin required');return {...fingerprintFile(path.dirname(file),path.basename(file)),path:file};}
function readPin(expected){const actual=pin(expected.path);requireThat(equal(actual,expected),'Raw input drift: '+expected.path);const raw=fs.readFileSync(expected.path);requireThat(raw.length===expected.bytes&&createHash('sha256').update(raw).digest('hex')===expected.sha256,'Raw input drift during read: '+expected.path);return raw;}
function json(file){return strictJSON(fs.readFileSync(file));}
function save(file,data){fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(data,null,2)),{flag:'wx'});}
function outside(owner,target){requireThat(!samePhysicalPath(owner,target),'Output overlaps input owner');let inside=false;try{ownerRelativePath(owner,target);inside=true;}catch{}requireThat(!inside,'Output inside input owner');}
function currentInputs(suite){
 const files=['tools/browser-resources.mjs','tools/browser-verify.mjs','tools/browser-tool-matrix.json','tools/lib/file-identity.mjs','tools/atlas-frame/boundary.mjs',SCRIPTS[suite]];
 const dirs=suite==='atlas'?['tools/atlas-frame','tools/atlas-import']:suite==='png'?['tools/browser-png']:['tools/prepared-resource-groups'];
 for(const directory of dirs)for(const name of fs.readdirSync(path.join(ROOT,directory)))if(name.endsWith('.mjs'))files.push(directory+'/'+name);
 return [...new Set(files)].sort().map(file=>pin(path.join(ROOT,file)));
}
function environment(playwright){
 assertBrowserEnvironment(process.env);
 requireThat(process.version==='v'+MATRIX.node&&!process.execArgv.length&&process.platform===MATRIX.platform&&process.arch===MATRIX.architecture,'Fixed Windows x64 / Node '+MATRIX.node+' without extra flags required');
 const installed=fs.realpathSync(playwright),require=createRequire(path.join(installed,'package.json'));
 const core=path.dirname(require.resolve('playwright-core/package.json'));
 for(const [owner,name] of [[installed,'playwright'],[core,'playwright-core']]){const data=json(path.join(owner,'package.json'));requireThat(data.name===name&&data.version===MATRIX.playwright,'Exact installed Playwright/core required');}
 return {installed,core,pins:[pin(process.execPath),pin(path.join(installed,'package.json')),pin(path.join(core,'package.json'))]};
}
function child(script,args,logBase,cwd=ROOT){
 const result=spawnSync(process.execPath,[script,...args],{cwd,windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:64*1024*1024});
 fs.writeFileSync(logBase+'.stdout.log',result.stdout??'',{flag:'wx'});fs.writeFileSync(logBase+'.stderr.log',result.stderr??'',{flag:'wx'});
 save(logBase+'.process.json',{script,args,cwd,exitCode:result.status,signal:result.signal,error:result.error?.message??null});
 requireThat(!result.error&&result.status===0,'Collector step failed; retained logs: '+logBase);return JSON.parse(result.stdout);
}
/** Authenticate host-side imported code before executing a disposable collector copy. */
export function verifyAtlasCollectorCopy(owner,kind){
 const files=['tools/verify-atlas-frame.mjs','tools/atlas-frame/boundary.mjs','tools/atlas-frame/scenario.mjs','tools/lib/file-identity.mjs',...(kind==='atlas-import-v1'?['tools/atlas-import/scenario.mjs']:[])];
 for(const key of files)requireThat(equal(fingerprintFile(owner,key),fingerprintFile(ROOT,key)),'Copied collector dependency differs: '+key);
}
/** Check the reviewed raw identities without requiring still-fresh output directories. */
export function verifyResourceCasePins(suite,row){
 const keys=suite==='png'?['admission']:suite==='atlas'?['config','snapshot','preparation']:suite==='prepared-groups'?['config','snapshot']:null;
 requireThat(keys,'Unknown resource family');for(const key of keys)readPin(row[key]);
}
/** Validate the whole family before starting any child; a partial list never earns family credit. */
export function validateResourceManifest(manifest){
 requireThat(manifest?.schemaVersion===1&&manifest.status==='PREPARED_REVIEW_REQUIRED'&&manifest.reviewed===false&&manifest.browserRun===false&&samePhysicalPath(manifest.repository??'',ROOT),'Invalid resource manifest');
 const schedule=resourceCases(manifest.suite);
 requireThat(Array.isArray(manifest.cases)&&equal(manifest.cases.map(({profile,kind})=>({profile,kind})),schedule),'Incomplete resource schedule');
 requireThat(equal(manifest.inputs,currentInputs(manifest.suite)),'Current collector input manifest differs');
 const runtime=environment(manifest.playwright);requireThat(equal(runtime.pins,manifest.runtime),'Current runtime differs');
 const root=manifest.outputOwner;requireThat(path.isAbsolute(root)&&samePhysicalPath(root,fs.realpathSync(root)),'Canonical manifest owner');outside(ROOT,root);
 for(const row of manifest.cases){
  ownerRelativePath(root,row.output);requireThat(!fs.existsSync(row.output),'Fresh native output required');
  if(manifest.suite==='png'){
   const admission=strictJSON(readPin(row.admission));requireThat(samePhysicalPath(admission.sourceFilesRoot,ROOT)&&samePhysicalPath(admission.outputOwner,path.dirname(row.output)),'PNG admission owner differs');
  }else{
   ownerRelativePath(root,row.config.path);ownerRelativePath(root,row.snapshot.path);
   const config=strictJSON(readPin(row.config));readPin(row.snapshot);
   requireThat(equal(config.nativeScenario,{profile:row.profile,kind:row.kind})&&samePhysicalPath(config.output,row.output)&&samePhysicalPath(config.snapshot,row.snapshot.path)&&samePhysicalPath(config.playwrightRoot,manifest.playwright),'Config scenario/output differs');
   const script=path.join(config.repositoryRoot,SCRIPTS[manifest.suite]);
   requireThat(equal({...pin(script),path:SCRIPTS[manifest.suite]},{...pin(path.join(ROOT,SCRIPTS[manifest.suite])),path:SCRIPTS[manifest.suite]}),'Copied collector bytes differ');
   if(manifest.suite==='prepared-groups')requireThat(config.expectedPhase==='GREEN'&&samePhysicalPath(config.repositoryRoot,ROOT),'Current GREEN repository required');
   else{ownerRelativePath(root,config.repositoryRoot);verifyAtlasCollectorCopy(config.repositoryRoot,row.kind);const preparation=strictJSON(readPin(row.preparation));const healthy=preparation.builds?.find(x=>x.role==='healthy');requireThat(healthy?.inputs?.length>0,'Actual healthy build inputs required');for(const input of healthy.inputs)requireThat(equal(fingerprintFile(ROOT,input.path),input),'Current source differs from prepared healthy build: '+input.path);}
  }
 }
 return manifest;
}
/** Supplement native oracles with exact family identity and complete retirement checks. */
export function validateResourceCompletion(suite,scenario,receipt){
 const empty=value=>Array.isArray(value)&&value.length===0;
 requireThat(receipt?.status==='PASS','Resource completion did not pass');
 if(suite==='png'){
  requireThat(receipt.node?.version==='v'+MATRIX.node&&receipt.browserVersion&&receipt.primaryOccurred===false&&empty(receipt.cleanupErrors)&&empty(receipt.pendingTicketIds)&&receipt.beforeAfterGraphStable===true&&receipt.sourceAndInstalledRuntimePinsStable===true&&receipt.browserCloseFulfilled===true&&receipt.serverCloseFulfilled===true,'Incomplete PNG receipt');
  requireThat(equal(receipt.contextRetirement?.map(x=>x.backend),['canvas','webgpu'])&&receipt.contextRetirement.every(x=>x.closeFulfilled)&&receipt.renderedSubmissions===6&&receipt.completeRawReadbacks===6&&receipt.newCaptures===4&&receipt.savedReplays===2&&equal(receipt.wrongOracleControls?.map(x=>x.backend),['canvas','webgpu'])&&receipt.wrongOracleControls.every(x=>x.pass),'Incomplete PNG completion schedule');return;
 }
 requireThat(receipt.environment?.node==='v'+MATRIX.node&&receipt.environment?.browserVersion&&receipt.environment?.playwrightVersion===MATRIX.playwright&&equal(receipt.nativeScenario,scenario)&&empty(receipt.failures)&&receipt.pendingOriginalTasks===0,'Incomplete resource receipt');
 if(suite==='prepared-groups'){
  requireThat(receipt.nativeAcceptance===(scenario.kind==='ordinary'?'FINITE_NATIVE_SEQUENCE_PASS':'FINITE_NATIVE_CONTROL_DETECTED')&&receipt.ordinaryAccepted===(scenario.kind==='ordinary')&&empty(receipt.retirementFailures)&&receipt.rawFrames?.length===(scenario.kind==='ordinary'?17:5)&&receipt.rawFrames.every(x=>x.status==='COMPARISON_SAVED')&&receipt.fixtureResult?.cases?.length===2&&receipt.fixtureResult.cases.every(x=>x.ok)&&receipt.acquiredOwners?.length>=2&&receipt.acquiredOwners.every(x=>receipt.retired?.[x]===true),'Incomplete prepared-group receipt');
 }else if(suite==='atlas'){
  const expected=scenario.kind==='atlas-import-v1'?'FINITE_NODE_TO_BROWSER_IMPORT_COMPOSITION_PASS':scenario.kind==='ordinary'?'FINITE_NATIVE_SEQUENCE_PASS':'FINITE_NATIVE_ASSIGNED_CONTROL_DETECTED';
  const count=['ordinary','atlas-import-v1'].includes(scenario.kind)?1:2;
  requireThat(receipt.nativeAcceptance===expected&&empty(receipt.cleanupErrors)&&receipt.retirement?.browser===true&&receipt.retirement?.context===true&&receipt.retirement.servers?.length===count&&receipt.retirement.servers.every(x=>x.closed)&&receipt.pages?.length===count&&receipt.frames?.length===(scenario.kind==='ordinary'?11:2)&&receipt.frames.every(x=>x.status==='COMPARED')&&receipt.after?.length===count,'Incomplete atlas receipt');
 }else throw Error('Unknown resource completion');
}
export async function prepareResources(options){
 const runtime=environment(options.playwright),output=path.resolve(options.output),parent=path.dirname(output);
 requireThat(samePhysicalPath(parent,fs.realpathSync(parent))&&!fs.existsSync(output),'Fresh output under canonical existing parent required');
 for(const owner of [ROOT,runtime.installed,runtime.core])outside(owner,output);
 const inputs=currentInputs(options.suite);let evidence;
 if(options.suite==='png'){const p=pin(options.evidence);requireThat(p.sha256===options['evidence-sha256'],'Original evidence digest differs');evidence=strictJSON(readPin(p));}
 fs.mkdirSync(output);const cases=[];
 for(const scenario of resourceCases(options.suite)){
  const id=scenario.profile+'-'+scenario.kind,caseRoot=path.join(output,id);fs.mkdirSync(caseRoot);
  if(options.suite==='png'){
   requireThat(evidence.schemaVersion===1&&samePhysicalPath(evidence.sourceFilesRoot,ROOT)&&samePhysicalPath(evidence.graphInputs?.repositoryRoot??'',ROOT),'Evidence must select current repository');
   requireThat(samePhysicalPath(evidence.runtime?.nodeExecutable?.path??'',process.execPath)&&samePhysicalPath(evidence.runtime?.playwrightEntry?.path??'',path.join(runtime.installed,'index.js')),'Evidence runtime selection differs');
   const {freezeBrowserPngGraph}=await import('./browser-png/file-graph.mjs');
   const {admitBrowserPngCollection}=await import('./browser-png/collector.mjs');
   const graphPath=path.join(caseRoot,'graph.json');save(graphPath,freezeBrowserPngGraph(evidence.graphInputs));
   const admissionPath=path.join(caseRoot,'admission.json');
   save(admissionPath,{...evidence,status:'BIP1_NATIVE_SOURCE_AND_ACTUAL_INPUTS_ADMITTED',outputOwner:caseRoot,graphPin:pin(graphPath)});
   const nativeOutput=path.join(caseRoot,'native-output'),admission=pin(admissionPath);admitBrowserPngCollection(admission,nativeOutput);
   cases.push({...scenario,admission,output:nativeOutput});
  }else{
   let prepared;
   if(options.suite==='prepared-groups')prepared=child(path.join(ROOT,'tools/prepared-resource-groups/prepare-native-config.mjs'),['--playwright',runtime.installed,'--workdir',caseRoot,'--profile',scenario.profile,'--kind',scenario.kind],path.join(caseRoot,'prepare'));
   else prepared=child(path.join(ROOT,'tools/atlas-frame/prepare-native.mjs'),['--repository',ROOT,'--task-root',caseRoot,'--destination',path.join(caseRoot,'closure'),'--playwright-root',runtime.installed,'--profile',scenario.profile,'--kind',scenario.kind],path.join(caseRoot,'prepare'));
   const configPath=prepared.config?.path??prepared.configPath,config=json(configPath),script=path.join(config.repositoryRoot,SCRIPTS[options.suite]);
   const configPin=pin(configPath);requireThat(configPin.sha256===(prepared.config?.sha256??prepared.configSha256),'Prepared configuration differs');
   child(script,['--config',configPath,'--config-sha256',configPin.sha256,'--snapshot-only'],path.join(caseRoot,'snapshot'),config.repositoryRoot);
   cases.push({...scenario,config:configPin,snapshot:pin(config.snapshot),...(options.suite==='atlas'?{preparation:pin(configPath+'.preparation.json')} : {}),output:config.output});
  }
 }
 requireThat(equal(inputs,currentInputs(options.suite)),'Preparation source changed');
 const manifest={schemaVersion:1,status:'PREPARED_REVIEW_REQUIRED',suite:options.suite,repository:ROOT,outputOwner:output,playwright:runtime.installed,runtime:runtime.pins,inputs,cases,reviewed:false,browserRun:false};
 validateResourceManifest(manifest);const file=path.join(output,'manifest.json');save(file,manifest);return {status:manifest.status,manifest:pin(file),cases:cases.length,reviewed:false,browserRun:false};
}
export async function runResources(options){
 const manifestPin=pin(options.manifest);requireThat(manifestPin.sha256===options.sha256,'Reviewed manifest digest differs');
 const manifest=validateResourceManifest(strictJSON(readPin(manifestPin))),results=[];
 // Recheck raw case identities at each launch and before completion; semantic equality is insufficient.
 for(const row of manifest.cases){
  verifyResourceCasePins(manifest.suite,row);
  let script,args,cwd=ROOT;
  if(manifest.suite==='png'){script=path.join(ROOT,SCRIPTS.png);args=['--admission',row.admission.path,'--output',row.output];}
  else{const config=strictJSON(readPin(row.config));cwd=config.repositoryRoot;script=path.join(cwd,SCRIPTS[manifest.suite]);args=['--config',row.config.path,'--config-sha256',row.config.sha256];}
  const log=path.join(path.dirname(row.output),'capture');
  child(script,args,log,cwd);
  const receiptPath=path.join(row.output,manifest.suite==='png'?'result.json':'report.json'),receipt=json(receiptPath);
  validateResourceCompletion(manifest.suite,{profile:row.profile,kind:row.kind},receipt);
  results.push({profile:row.profile,kind:row.kind,receipt:pin(receiptPath),status:'PASS'});
 }
 for(const row of manifest.cases)verifyResourceCasePins(manifest.suite,row);
 readPin(manifestPin);requireThat(equal(manifest.inputs,currentInputs(manifest.suite))&&equal(manifest.runtime,environment(manifest.playwright).pins),'Inputs changed during capture');
 const report={schemaVersion:1,status:'PASS',suite:manifest.suite,manifest:manifestPin,node:process.version,cases:results,scope:'Bounded desktop collection only; no human onboarding, device, performance or historical-domain retirement acceptance.'};
 save(path.join(manifest.outputOwner,'result.json'),report);return report;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
 if(process.argv.slice(2).join(' ')==='--help')console.log('prepare --suite prepared-groups|atlas|png --playwright <absolute package> --output <fresh absolute directory> [PNG only: --evidence <absolute original evidence JSON> --evidence-sha256 <sha256>]\nReview the complete manifest, snapshots and original evidence, then: run --manifest <absolute manifest.json> --sha256 <reviewed digest>');
 else{const options=parseResourceOptions(process.argv.slice(2));console.log(JSON.stringify(await (options.action==='prepare'?prepareResources(options):runResources(options))));}
}
