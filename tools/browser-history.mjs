// SPDX-License-Identifier: Apache-2.0
// Historical domains on the current rig. Preparation records facts; review remains separate.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
import {assertBrowserEnvironment} from './browser-verify.mjs';
const ROOT=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const SCRIPTS={'textured-webgpu':'tools/verify-textured-webgpu.mjs','textured-scene':'tools/verify-textured-scene-webgpu.mjs','sequence-player':'tools/sequence-player/collector.mjs','sequence-playback':'tools/sequence-playback/collector.mjs',spritesheet:'tools/spritesheet/collector.mjs'};
const directories={'textured-webgpu':['tools/textured-webgpu','examples/textured-webgpu'],'textured-scene':['tools/textured-scene-webgpu'],'sequence-player':['tools/sequence-player'],'sequence-playback':['tools/sequence-playback'],spritesheet:['tools/spritesheet']};
const needsAdmission=s=>['sequence-playback','spritesheet'].includes(s);
const check=(ok,message)=>{if(!ok)throw Error(message);};const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function historyPin(file){const actual=fs.realpathSync(file);return {...fingerprintFile(path.dirname(actual),path.basename(actual)),path:actual};}
export function verifyHistoryPins(rows){check(Array.isArray(rows)&&rows.length>0,'Nonempty input pins required');const seen=new Set();for(const row of rows){check(row&&path.isAbsolute(row.path),'Absolute input required');const actual=historyPin(row.path),key=process.platform==='win32'?actual.path.toLowerCase():actual.path;check(!seen.has(key),'Duplicate input');seen.add(key);check(equal(actual,row),'Raw input drift: '+row.path);}return rows;}
function readPin(row){verifyHistoryPins([row]);const raw=fs.readFileSync(row.path);check(raw.length===row.bytes&&createHash('sha256').update(raw).digest('hex')===row.sha256,'Input changed while reading');return JSON.parse(raw);}
function save(file,value){fs.writeFileSync(file,canonicalTextBytes(JSON.stringify(value,null,2)),{flag:'wx'});return historyPin(file);}
function outside(owner,target){check(!samePhysicalPath(owner,target),'Output overlaps owner');let contains=false;try{ownerRelativePath(owner,target);contains=true;}catch{}check(!contains,'Output inside input owner');}
export function parseHistoryOptions(args){
 const [action,...rest]=args;check(['prepare','run'].includes(action),'Expected prepare or run');const options={action};
 for(let i=0;i<rest.length;i+=2){check(/^--[a-z][a-z0-9-]*$/.test(rest[i])&&rest[i+1]&&!Object.hasOwn(options,rest[i].slice(2)),'Unique named options required');options[rest[i].slice(2)]=rest[i+1];}
 const keys=action==='run'?['action','manifest','sha256']:['action','suite','playwright','output',...(needsAdmission(options.suite)?['admission','admission-sha256']:[])];
 check(equal(Object.keys(options).sort(),keys.sort()),'Exact options required');if(action==='prepare')check(Object.hasOwn(SCRIPTS,options.suite),'Unknown suite');
 for(const name of ['manifest','playwright','output','admission'])if(options[name])check(path.isAbsolute(options[name]),'Absolute '+name+' required');
 for(const name of ['sha256','admission-sha256'])if(options[name])check(/^[a-f0-9]{64}$/.test(options[name]),'Lowercase SHA-256 required');return options;
}
function runtime(playwright){assertBrowserEnvironment(process.env);check(process.version==='v26.7.0'&&!process.execArgv.length&&process.platform==='win32'&&process.arch==='x64','Fixed Windows x64 Node26.7.0 required');
 const installed=fs.realpathSync(playwright),require=createRequire(path.join(installed,'package.json')),core=path.dirname(require.resolve('playwright-core/package.json'));
 check(samePhysicalPath(core,path.resolve(installed,'../playwright-core')),'Exact adjacent installed core required');
 const rows=[historyPin(process.execPath)];for(const [owner,name] of [[installed,'playwright'],[core,'playwright-core']]){const pin=historyPin(path.join(owner,'package.json')),meta=readPin(pin);check(meta.name===name&&meta.version==='1.62.1','Pinned Playwright/core required');rows.push(pin);}return {installed,core,pins:rows};
}
function walk(directory,predicate){const files=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.name==='node_modules')continue;check(!entry.isSymbolicLink(),'Unexpected input link');const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.isFile()&&predicate(file))files.push(file);check(files.length<=4096,'Input count limit');}}visit(directory);return files;}
function currentInputs(suite){
 const files=['tools/browser-history.mjs','tools/browser-history-build.mjs','tools/browser-verify.mjs','tools/browser-tool-matrix.json','tools/lib/file-identity.mjs','tools/build.mjs','tools/generate-project-format.mjs','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json',SCRIPTS[suite]];
 if(suite==='textured-webgpu')files.push('tools/freeze-textured-webgpu-inputs.mjs','source-origin.json');
 let absolute=files.map(x=>path.join(ROOT,x));for(const dir of directories[suite])absolute.push(...walk(path.join(ROOT,dir),()=>true));
 for(const name of ['contracts','runtime','engine','project'])absolute.push(...walk(path.join(ROOT,'packages',name),file=>/\.(?:ts|js|json)$/.test(file)&&!file.includes(path.sep+'node_modules'+path.sep)));
 return [...new Set(absolute)].sort().map(historyPin);
}
// Only declared evidence pins are traversed. Plain review labels are never generated here.
function evidencePins(value,result=new Map()){check(result.size<4096,'Evidence graph budget');if(!value||typeof value!=='object')return [...result.values()];if(typeof value.path==='string'&&path.isAbsolute(value.path)&&Number.isSafeInteger(value.bytes)&&/^[a-f0-9]{64}$/.test(value.sha256??'')){const pin=historyPin(value.path);check(pin.bytes===value.bytes&&pin.sha256===value.sha256,'Admission evidence drift');result.set(pin.path,pin);if(pin.path.endsWith('.json')){check(pin.bytes<=8*1024*1024,'Evidence JSON budget');const nested=JSON.parse(fs.readFileSync(pin.path));if(!result.has('seen:'+pin.path)){result.set('seen:'+pin.path,null);evidencePins(nested,result);}}}else for(const item of Object.values(value))evidencePins(item,result);return [...result.values()].filter(Boolean);}
function child(script,args,log){const result=spawnSync(process.execPath,[path.join(ROOT,script),...args],{cwd:ROOT,windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:64*1024*1024});fs.writeFileSync(log+'.stdout.log',result.stdout??'',{flag:'wx'});fs.writeFileSync(log+'.stderr.log',result.stderr??'',{flag:'wx'});save(log+'.process.json',{script,args,exitCode:result.status,signal:result.signal,error:result.error?.message??null});check(!result.error&&result.status===0,'Collector step failed; inspect '+log);}
export function validateHistoryCompletion(suite,r){
 const empty=x=>Array.isArray(x)&&x.length===0;
 check(r&&r.environment?.node==='v26.7.0','Current runtime receipt required');
 if(suite==='textured-webgpu'){
  check(r.status==='PASS'&&r.exitCode===0&&equal(r.counts,{calibrationCases:11,heldOutCases:10,controlWindows:16,controlsSensitive:12,positiveObservations:27,controlObservations:19}),'Incomplete texture schedule');
  check(r.lifecycle?.identitiesStable===true&&r.lifecycle.artifactsStable===true&&r.lifecycle.standaloneCleanupObserved===true&&r.lifecycle.browserClosed===true&&r.lifecycle.serverClosed===true&&r.lifecycle.pendingApiOperations===0&&empty(r.cleanupFailures)&&empty(r.registryFailures),'Incomplete texture retirement');
 }else if(suite==='textured-scene'){
  check(r.status==='PASS'&&r.exitCode===0&&r.rawCheck?.status==='PASS'&&r.rawCheck.observations===2&&r.rawCheck.checkedPixels===24&&r.sensitivity?.status==='EXPECTED_PIXEL_REJECTION'&&r.safeNative?.status==='PASS','Incomplete mixed-scene receipt');
  check(r.environment.browserVersion&&r.failure===null&&empty(r.cleanupFailures)&&empty(r.browserEvents)&&r.lifecycle?.pageClosed===true&&r.lifecycle.contextClosed===true&&r.lifecycle.browserClosed===true&&r.lifecycle.serverClosed===true&&r.lifecycle.identitiesStable===true&&r.lifecycle.artifactsStable===true&&r.lifecycle.pendingOperations===0&&r.lifecycle.lateAcquisitionsSettled===true&&r.lifecycle.cooperativeAPIClosure===true,'Incomplete mixed-scene retirement');
 }else{
  const status={'sequence-player':'PASS_OPAQUE_REGION_SUBSET','sequence-playback':'PASS_SEQUENCE_PLAYBACK_OPAQUE_SUBSET',spritesheet:'PASS_SPRITESHEET_OPAQUE_SUBSET'}[suite],count=suite==='sequence-player'?8:18;
  check(status&&r.status===status&&r.completedCaptures===count&&r.comparedPixels===count*32&&r.comparedChannels===count*128&&r.firstError===null&&r.overflow===false&&r.identitiesStable===true&&r.environment.browserVersion&&r.retirement?.browser==='closed'&&r.retirement.server==='closed'&&r.retirement.contexts?.length===2&&r.retirement.contexts.every(x=>x.state==='closed')&&r.retirement.fixtures?.length===2,'Incomplete sequence receipt');
  check(r.captures?.length===count&&['canvas','webgpu'].every(b=>equal(r.captures.filter(x=>x.backend===b).map(x=>x.step),r.requestedStepsPerBackend))&&r.captures.every(x=>x.observation.pass===true),'Incomplete capture schedule');
  if(suite!=='sequence-player')check(r.completedNewCaptures===16&&r.completedReplays===2&&r.compilerOwnership?.stable===true,'Incomplete clock replay or compiler ownership');
  if(suite==='spritesheet')check(r.workspaceOwnership?.stable===true,'Incomplete workspace ownership');
 }
}
export function prepareHistory(options){
 const env=runtime(options.playwright),output=path.resolve(options.output);check(samePhysicalPath(path.dirname(output),fs.realpathSync(path.dirname(output)))&&!fs.existsSync(output),'Fresh output under canonical parent required');for(const owner of [ROOT,env.installed,env.core])outside(owner,output);
 let admission=null,evidence=[];if(needsAdmission(options.suite)){admission=historyPin(options.admission);check(admission.sha256===options['admission-sha256'],'Admission digest differs');const value=readPin(admission);check(value.schemaVersion===options.suite+'-native-admission/1'&&samePhysicalPath(value.repositoryRoot,ROOT),'Admission owner/suite differs');evidence=evidencePins(value);}
 fs.mkdirSync(output);let freeze=null,build=null;
 if(options.suite==='textured-scene'){child('tools/build.mjs',[],path.join(output,'current-build'));build=['current-build.stdout.log','current-build.stderr.log','current-build.process.json'].map(n=>historyPin(path.join(output,n)));}
 if(options.suite==='textured-webgpu'){const directory=path.join(output,'freeze');child('tools/freeze-textured-webgpu-inputs.mjs',['--output',directory],path.join(output,'freeze-build'));freeze={directory,pins:walk(directory,()=>true).map(historyPin)};}
 const manifest={schemaVersion:1,status:'PREPARED_REVIEW_REQUIRED',reviewed:false,browserRun:false,suite:options.suite,repository:ROOT,playwright:env.installed,runtime:env.pins,inputs:currentInputs(options.suite),admission,evidence,freeze,build,output:path.join(output,'native'),limits:['Independent review required before run.','Original collector admissions and external OS retirement remain separate.','No phone, performance, complete Spine or migration acceptance.']};
 return {status:manifest.status,manifest:save(path.join(output,'manifest.json'),manifest),reviewed:false,browserRun:false};
}
export function runHistory(options){
 const pin=historyPin(options.manifest);check(pin.sha256===options.sha256,'Reviewed manifest digest differs');const manifest=readPin(pin);check(manifest.schemaVersion===1&&manifest.status==='PREPARED_REVIEW_REQUIRED'&&manifest.reviewed===false&&manifest.browserRun===false&&Object.hasOwn(SCRIPTS,manifest.suite)&&samePhysicalPath(manifest.repository,ROOT),'Invalid manifest');
 const env=runtime(manifest.playwright);check(equal(env.pins,manifest.runtime)&&equal(currentInputs(manifest.suite),manifest.inputs),'Current runtime or source inventory differs');verifyHistoryPins(manifest.inputs);if(manifest.admission)verifyHistoryPins([manifest.admission,...manifest.evidence]);if(manifest.freeze)verifyHistoryPins(manifest.freeze.pins);if(manifest.suite==='textured-scene'){verifyHistoryPins(manifest.build);check(manifest.build.length===3&&readPin(manifest.build[2]).exitCode===0,'Actual mixed-scene build required');}
 const owner=path.dirname(pin.path);check(samePhysicalPath(manifest.output,path.join(owner,'native'))&&!fs.existsSync(manifest.output),'Fresh selected output required');for(const input of [ROOT,env.installed,env.core])outside(input,owner);
 const args=['--playwright',env.installed,'--channel','msedge','--output',manifest.output];
 if(needsAdmission(manifest.suite)){check(manifest.admission,'Original admission required');args.push('--admission',manifest.admission.path);}
 if(manifest.suite==='textured-webgpu'){check(manifest.freeze&&samePhysicalPath(manifest.freeze.directory,path.join(owner,'freeze')),'Prepared freeze required');args.push('--freeze',manifest.freeze.directory);}
 if(manifest.suite==='textured-scene')args.push('--snapshot',pin.path,'--snapshot-sha256',pin.sha256);
 child(SCRIPTS[manifest.suite],args,path.join(owner,'collector'));
 for(const rows of [[pin],manifest.runtime,manifest.inputs,manifest.evidence,...(manifest.admission?[[manifest.admission]]:[]),...(manifest.freeze?[manifest.freeze.pins]:[]),...(manifest.build?[manifest.build]:[])])if(rows.length)verifyHistoryPins(rows);
 check(equal(currentInputs(manifest.suite),manifest.inputs),'Input membership changed');const resultPin=historyPin(path.join(manifest.output,'result.json')),result=readPin(resultPin);validateHistoryCompletion(manifest.suite,result);
 const receipt={schemaVersion:1,status:'PASS_BOUNDED_COLLECTOR',suite:manifest.suite,manifest:pin,result:resultPin,node:process.version,originalStatus:result.status,osRetirement:'SEPARATE_EXTERNAL_OWNER_REQUIRED',humanValidation:false,deviceMatrix:false};save(path.join(owner,'result.json'),receipt);return receipt;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){const options=parseHistoryOptions(process.argv.slice(2));console.log(JSON.stringify(options.action==='prepare'?prepareHistory(options):runHistory(options),null,2));}
