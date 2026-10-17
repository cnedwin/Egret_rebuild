// SPDX-License-Identifier: Apache-2.0
// Fixed current browser entry; absent capabilities and child failures never pass.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const matrix=JSON.parse(fs.readFileSync(new URL('./browser-tool-matrix.json',import.meta.url),'utf8'));
export function parseBrowserOptions(args){
 const result={};for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--suite','--playwright','--output','--snapshot','--snapshot-sha256'].includes(key)||Object.hasOwn(result,key.slice(2))||!args[i+1])throw Error('Expected unique --suite, --playwright and --output values');result[key.slice(2)]=args[i+1];}
 const selected=matrix.current.find(row=>row.id===result.suite);
 if(!selected||!result.playwright||!result.output)throw Error('A declared current suite and installed package/output are required');
 if(selected.snapshot){if(!result.snapshot||!path.isAbsolute(result.snapshot)||!/^\w{64}$/.test(result['snapshot-sha256']??'')||!/^[a-f0-9]+$/.test(result['snapshot-sha256']))throw Error('Reviewed absolute snapshot and lowercase SHA-256 required');}
 else if(result.snapshot||result['snapshot-sha256'])throw Error('This suite does not accept a source snapshot');return result;
}

/** Refuse inherited loaders before creating outputs or spawning a collector. */
export function assertBrowserEnvironment(env){
 for(const key of Object.keys(env))if(['NODE_OPTIONS','NODE_PATH'].includes(key.toUpperCase())&&env[key])throw Error('Inherited Node loader configuration is not accepted: '+key);
}
/** A zero exit is necessary, but never substitutes for a suite completion receipt. */
export function readCompletion(suite,output,stdout){
 const receipt=suite==='canvas'?JSON.parse(stdout):JSON.parse(fs.readFileSync(path.join(output,['resource-scene','bitmap-slot'].includes(suite)?'report.json':'result.json'),'utf8'));
 if(suite==='canvas'){
  if(!receipt.browser||receipt.playwright!==matrix.playwright||receipt.channel!==matrix.channel||receipt.headless!==true||receipt.pointerPixelsChanged!==true||!receipt.checks?.length||receipt.counterexample?.failed!==true||receipt.unexpectedErrors?.length!==0)throw Error('Incomplete Canvas receipt');
  for(const name of ['example-before.png','example-after.png','acceptance.png'])if(!fs.statSync(path.join(output,name)).isFile()||fs.statSync(path.join(output,name)).size===0)throw Error('Missing Canvas artifact');
 }else if(suite==='webgpu'){
  if(receipt.status!=='PASS'||!receipt.browser||receipt.originalProductPreserved!==true||receipt.fixtureFailures?.length!==0||!(receipt.counts?.rawChecks>0)||!(receipt.counts?.counterexamples>0))throw Error('Incomplete WebGPU receipt');
 }else if(suite==='b1'){
  if(receipt.status!=='PASS'||receipt.exitCode!==0||!receipt.browserVersion||receipt.cleanupFailures?.length!==0||receipt.counts?.positiveFrames!==7||receipt.counts?.counterexamples!==5)throw Error('Incomplete B1 receipt');
 }else if(suite==='text'){
  if(receipt.status!=='PASS_WC1_CANVAS_SUBSET'||receipt.exitCode!==0||receipt.identitiesStable!==true)throw Error('Incomplete text subset receipt');
 }else if(suite==='hit-test'||suite==='mouse-input'){
  const expected=suite==='hit-test'?'PASS_DESKTOP_HT1_CANVAS_SUBSET':'PASS_DESKTOP_PRIMARY_MOUSE_CANVAS_SUBSET';
  if(receipt.status!==expected||receipt.nativeInputAccepted!==true)throw Error('Incomplete native input receipt');
  const collection=JSON.parse(fs.readFileSync(path.join(output,'collection.json'),'utf8'));
  if(collection.environment?.node!=='v'+matrix.node||!collection.environment?.browserVersion||collection.environment?.channel!==matrix.channel||collection.retirement?.browserClosed!==true||collection.retirement?.serverClosed!==true||collection.retirement?.pendingActors!==0)throw Error('Incomplete native input environment or retirement');
  const results=suite==='hit-test'?receipt.controls:receipt.results?.slice(1);
  const hitIds=['omit-query','omit-css','omit-dispatch','capture-only','omit-retirement'];
  const mouseIds=['OMIT_BEGIN','RETARGET_END','OMIT_Q2','CANVAS_ONLY_CSS','DPR_MULTIPLY','OMIT_PHYSICAL_REMOVE'];
  const witnesses=['BEGIN_ROUTE','END_TARGET','ACTIVATION_SUPPRESSED','CSS_REFUSAL','WRONG_X_PAYLOAD_B03','PHYSICAL_REMOVAL'];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(!same(collection.contexts?.map(row=>row.id),['baseline',...(suite==='hit-test'?hitIds:mouseIds)]))throw Error('Incomplete native context schedule');
  if(!Array.isArray(results)||results.some(row=>row.status!=='PASS_ASSIGNED_CONTROL_SENSITIVITY')||!same(results.map(row=>suite==='hit-test'?row.id:row.witness),suite==='hit-test'?hitIds:witnesses))throw Error('Missing or duplicate assigned native controls');
  if(suite==='hit-test'?!same(receipt.issues,[]):receipt.results[0]?.status!=='PASS_NATIVE_BASELINE'||!same(receipt.results[0]?.issues,[]))throw Error('Native baseline did not pass');
  return {status:receipt.status,browser:collection.environment.browserVersion};
 }else if(suite==='resource-scene'||suite==='bitmap-slot'){
  const expected=suite==='resource-scene'?'PASS_FINITE_RECORDED_DESKTOP_RESOURCE_SCENE':'PASS_BOUNDED_RECORDED_BROWSER_COMPOSITION';
  if(receipt.status!==expected||receipt.accepted!==true||receipt.environment?.node!=='v'+matrix.node||!receipt.environment?.browserVersion||receipt.failures?.length!==0||receipt.retirementFailures?.length!==0||receipt.pendingOperations!==0||receipt.resourcesRetired!==true||receipt.runs?.length!==(suite==='resource-scene'?7:4)||receipt.runs.some(row=>suite==='resource-scene'?row.completed!==true:row.completedSchedule!==true))throw Error('Incomplete advanced composition receipt');
  const schedule=suite==='resource-scene'
   ?[['canvas-2d','ordinary'],['webgpu-scene-textured','ordinary'],['canvas-2d','wrong-outfit'],['webgpu-scene-textured','wrong-outfit'],['canvas-2d','wrong-time'],['webgpu-scene-textured','wrong-time'],['webgpu-scene-textured','wrong-depth']]
   :[['canvas','ordinary'],['canvas','wrong-color-control'],['webgpu','ordinary'],['webgpu','wrong-color-control']];
  if(JSON.stringify(receipt.runs.map(row=>[row.profile??row.backend,row.kind]))!==JSON.stringify(schedule))throw Error('Incomplete advanced composition schedule');
 }else throw Error('Unknown completion suite');
 return {status:receipt.status??'PASS_CANVAS_SUBSET',browser:receipt.browser??receipt.browserVersion??receipt.environment?.browserVersion??null};
}

export function runBrowser(args){
 assertBrowserEnvironment(process.env);
 const options=parseBrowserOptions(args);
 if(process.version!=='v'+matrix.node||process.execArgv.length||process.platform!==matrix.platform||process.arch!==matrix.architecture)throw Error('Selected Windows x64 / Node '+matrix.node+' without extra flags required');
 if(fs.readFileSync(path.join(root,'.node-version'),'utf8').trim()!==matrix.node)throw Error('Browser and repository Node versions differ');
 if(!path.isAbsolute(options.playwright)||!path.isAbsolute(options.output))throw Error('Absolute installed package and fresh output paths required');
 const installed=fs.realpathSync.native(options.playwright),output=path.resolve(options.output);
 const parent=path.dirname(output);
 if(!samePhysicalPath(parent,fs.realpathSync.native(parent))||fs.existsSync(output))throw Error('Output requires a canonical existing parent and absent child');
 for(const owner of [root,installed]){
  if(samePhysicalPath(owner,output))throw Error('Output overlaps an input owner');
  let inside=false;try{ownerRelativePath(owner,output);inside=true;}catch{}if(inside)throw Error('Output is inside an input owner');
 }
 const packagePin=fingerprintFile(installed,'package.json'),meta=JSON.parse(fs.readFileSync(path.join(installed,'package.json')));
 const require=createRequire(path.join(installed,'package.json')),core=path.dirname(require.resolve('playwright-core/package.json'));
 const corePin=fingerprintFile(core,'package.json'),coreMeta=JSON.parse(fs.readFileSync(path.join(core,'package.json')));
 if(meta.name!=='playwright'||meta.version!==matrix.playwright||coreMeta.name!=='playwright-core'||coreMeta.version!==matrix.playwright)throw Error('Exact installed Playwright/core '+matrix.playwright+' required');
 let overlapsCore=samePhysicalPath(core,output);try{ownerRelativePath(core,output);overlapsCore=true;}catch{}if(overlapsCore)throw Error('Output overlaps the installed core');
 const selected=matrix.current.find(row=>row.id===options.suite);
 let snapshotPin=null;
 if(selected.snapshot){snapshotPin=fingerprintFile(path.dirname(options.snapshot),path.basename(options.snapshot));if(snapshotPin.sha256!==options['snapshot-sha256'])throw Error('Reviewed snapshot digest differs');}
 const pins=[fingerprintFile(root,'tools/browser-verify.mjs'),fingerprintFile(root,'tools/browser-tool-matrix.json'),fingerprintFile(root,selected.script)];
 fs.mkdirSync(output);const childOutput=path.join(output,'artifacts');
 const childArgs=[path.join(root,selected.script),'--playwright',installed,...(selected.repository?['--repository',root]:[]),...(selected.snapshot?['--snapshot',options.snapshot]:[]),...(selected.channel?['--channel',matrix.channel]:[]),'--output',childOutput];
 const started=new Date().toISOString();
 const result=spawnSync(process.execPath,childArgs,{cwd:root,windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:64*1024*1024});
 fs.writeFileSync(path.join(output,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(output,'stderr.log'),result.stderr??'');
 const stable=(!snapshotPin||JSON.stringify(fingerprintFile(path.dirname(options.snapshot),path.basename(options.snapshot)))===JSON.stringify(snapshotPin))&&pins.every(pin=>JSON.stringify(fingerprintFile(root,pin.path))===JSON.stringify(pin))&&JSON.stringify(fingerprintFile(installed,'package.json'))===JSON.stringify(packagePin)&&JSON.stringify(fingerprintFile(core,'package.json'))===JSON.stringify(corePin);
 let completion=null,completionError=null;try{completion=readCompletion(options.suite,childOutput,result.stdout??'');}catch(error){completionError=error.message;}
 const report={snapshot:snapshotPin,completion,completionError,schemaVersion:1,suite:options.suite,node:process.version,playwright:matrix.playwright,channel:matrix.channel,started,finished:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message??null,inputs:pins,stable,status:!result.error&&result.status===0&&stable&&completion?'PASS':'INCOMPLETE',limits:['Only the selected suite and its recorded domain.','No phone, performance, complete engine or independent OS process-retirement acceptance.','Advanced and historical collectors retain separate obligations.']};
 fs.writeFileSync(path.join(output,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)));
 console.log(JSON.stringify(report));if(report.status!=='PASS')throw Error('Browser suite did not pass; inspect retained stdout/stderr and child artifacts');return report;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))runBrowser(process.argv.slice(2));
