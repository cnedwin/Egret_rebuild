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

// Fixed reviewed schedule. Reading the fixture data below never imports the SDK.
const sharedCaseIds=['A00-endpoints','A01-alpha-flat','A02-alpha-opaque','B00-black-white',
 'B01-nongray-equal-alpha','B02-nongray-vary-alpha','B03-two-color-alpha','C00-singleton-trim',
 'C01-one-by-five','C02-odd-all-rotations','C03-opposite-contact','D00-domain-choice','D01-address-seams',
 'D02-nearest-floor','E00-region-interpolation','E01-page-seam-interpolation','E02-nine-slice-seams',
 'E03-nine-slice-zero-center','E04-clip-coverage','F00-blends-transparent','F01-blends-opaque',
 'F02-order-and-factor','F03-mixed-opaque','G00-linear-b1-ui0','G01-linear-b1-ui1','G02-linear-b1-ui2',
 'G03-linear-b1-ui3','H00-size-pair','H01-size-pair','H02-size-pair'];
const sharedControls=[
 ['N01-encoded-average','B00-black-white','wx0.5-wy0.5',0],
 ['N02-missing-source-decode','A01-alpha-flat','nongray-a255',1],
 ['N03-missing-dark','B03-two-color-alpha','dark-only-black',0],
 ['N04-double-pma','A01-alpha-flat','white-a128',0],
 ['N05-no-trim-coverage','C00-singleton-trim','single-bounded-left',3],
 ['N06-page-clamp-for-region','H00-size-pair','H-16x16-bounded-left',2],
 ['N07-css-multiply','F02-order-and-factor','factor-transparent-white',0],
 ['N08-skip-transparent-resolve','A01-alpha-flat','white-a128',0],
 ['N09-b1-decode-after-interpolation','G00-linear-b1-ui0','p0',0],
 ['N10-rgba-bgra-swap','A00-endpoints','red',0],
 ['N11-painter-reorder','F02-order-and-factor','A-B-A',0],
];
function sharedCompletion(receipt,output){
 const need=(value,label)=>{if(!value)throw Error('Incomplete shared WebGPU receipt: '+label);};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const empty=value=>Array.isArray(value)&&value.length===0;
 const pin=value=>Number.isSafeInteger(value?.bytes)&&value.bytes>0&&/^[a-f0-9]{64}$/.test(value.sha256);
 const artifact=(value,name)=>{
  need(value?.name===name&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(name)&&pin(value),'artifact identity');
  const actual=fingerprintFile(output,name);need(actual.bytes===value.bytes&&actual.sha256===value.sha256,'artifact changed: '+name);
 };
 const manifest=JSON.parse(fs.readFileSync(new URL('./shared-rendering/native-cases.json',import.meta.url),'utf8'));
 const controls=JSON.parse(fs.readFileSync(new URL('./shared-rendering/native-controls.json',import.meta.url),'utf8'));
 need(same(manifest.cases.map(row=>row.id),sharedCaseIds)&&manifest.cases.reduce((n,row)=>n+row.points.length,0)===321,'fixed cases');
 need(same(controls.map(row=>[row.id,row.caseId,row.pointId]),sharedControls.map(row=>row.slice(0,3))),'fixed controls');
 const schedule=sharedCaseIds.map(id=>['positive',id]);
 for(const [id,caseId] of sharedControls)schedule.push(['baseline-'+id,caseId],[id,caseId],['restored-'+id,caseId]);
 need(receipt.schemaVersion===1&&receipt.status==='PASS'&&receipt.node==='v'+matrix.node&&typeof receipt.browser==='string'&&receipt.browser.length>0,'environment/status');
 need(receipt.launch?.channel===matrix.channel&&receipt.launch.headless===true&&receipt.launch.deviceScaleFactor===1&&empty(receipt.launch.additionalFlags),'launch');
 need(receipt.counts?.cases===30&&receipt.counts.points===321&&receipt.counts.controls===11,'counts');
 need(empty(receipt.errors)&&empty(receipt.cleanupFailures)&&receipt.browserClosed===true&&receipt.serverClosed===true&&receipt.identitiesStable===true,'errors/retirement/identity');
 need(Array.isArray(receipt.requests)&&receipt.requests.length>0&&receipt.requests.every(row=>row.status===200),'requests');
 need(Array.isArray(receipt.runs)&&same(receipt.runs.map(row=>[row.mode,row.caseId]),schedule),'63-run schedule');
 need(Array.isArray(receipt.controls)&&same(receipt.controls.map(row=>row.id),sharedControls.map(row=>row[0])),'11 assigned controls');
 artifact(receipt.input,'input-closure.json');
 function idle(value,closed,scene){
  const host=value?.hostStatus,shared=value?.sharedStatus;
  need(host?.state===(closed?'closed':'active')&&host.lastSerial===1&&host.pendingFrames===0&&host.pendingUploadBytes===0
   &&host.pendingReadbackBytes===0&&host.firstFailure===null&&host.callbackFailureCount===0&&host.lastCallbackFailure===null
   &&host.cleanupOutcome===(closed?'safe':'not-started'),'Host pending/cleanup');
  need(shared?.pendingGeometryBytes===0&&shared.pendingColorBytes===0&&shared.pendingCanonicalBytes===0&&same(shared.host,host),'shared pending');
  if(scene){const s=value.sceneStatus;need(s?.pendingSceneBytes===0&&s.pendingUniformBytes===0&&s.pendingDepthBytes===0&&same(s.host,host),'B1 pending');}
 }
 for(const [index,row] of receipt.runs.entries()){
  const def=manifest.cases.find(value=>value.id===row.caseId),native=row.native,cleanup=native?.cleanup;
  const assigned=sharedControls.find(value=>value[0]===row.mode);
  need(row.contextClosed===true&&row.failure===null&&empty(row.errors),'run/context failure');
  need(native?.caseId===row.caseId&&native.status==='COMPLETE'&&native.failure===null&&native.deviceAcquired===true
   &&native.adapter&&native.adapter.isFallbackAdapter!==true&&native.device&&native.observationRetained===true,'actual native completion');
  need(native.unexpectedDeviceLoss===false&&native.overflow===false&&empty(native.uncaptured)&&empty(native.hostDiagnostics)&&empty(native.engineDiagnostics),'native errors');
  need(native.deviceLoss?.reason==='destroyed'&&native.deviceLoss.destroyRequested===true,'expected device loss');
  need(cleanup?.scopeClosed===true&&cleanup.engineClosed===true&&cleanup.hostClosed===true&&cleanup.deviceDestroyed===true
   &&cleanup.lossSettled===true&&empty(cleanup.pendingActors)&&empty(cleanup.failures),'native retirement');
  idle(native.beforeObservation,false,def.scene);idle(cleanup,true,def.scene);
  const regions=[...new Set(def.draws.map(draw=>draw.regionId).filter(id=>id!==undefined))];
  need(same(native.inputs?.regions?.map(value=>value.id),regions)&&same(cleanup.textures?.map(value=>value.id),regions)
   &&cleanup.textures.every(value=>value.disposed===true&&value.providerDisposals===1),'resource retirement');
  need(native.frame?.frameId===1&&native.frame.profile==='egret.shared-frame2d/1'&&native.frame.width===256
   &&native.frame.height===256&&native.frame.outputAlpha===def.outputAlpha,'captured frame');
  need(Array.isArray(row.observations)&&row.observations.length===1,'one raw observation');
  const observation=row.observations[0],readback=observation.readback;
  need(readback?.width===256&&readback.height===256&&readback.format==='rgba8unorm'&&readback.colorSpace==='srgb'
   &&readback.alphaMode===def.outputAlpha&&readback.serial===1&&readback.frameId===native.frame.frameId
   &&['rgba8unorm','bgra8unorm'].includes(readback.sourceFormat),'readback');
  const prefix=String(index+1).padStart(3,'0')+'-'+row.mode+'-'+row.caseId;
  need(observation.raw?.bytes===262144,'raw extent');artifact(observation.raw,prefix+'.rgba');
  need(Array.isArray(observation.pngs)&&observation.pngs.length===2,'background screenshots');
  for(const [i,color] of ['black','white'].entries())artifact(observation.pngs[i],prefix+'-'+color+'.png');
  const raw=fs.readFileSync(path.join(output,observation.raw.name));
  need(Array.isArray(observation.samples)&&same(observation.samples.map(value=>value.id),def.points.map(value=>value.id)),'named samples');
  for(const [i,sample] of observation.samples.entries()){
   const point=def.points[i],offset=4*(point.y*256+point.x),actual=[...raw.subarray(offset,offset+4)];
   const differences=actual.map((value,channel)=>Math.abs(value-point.expectedRGBA[channel]));
   const failed=point.channels.filter(channel=>differences[channel]>point.tolerance[channel]);
   const bleed=point.bleed?actual[point.bleed.channel]>point.bleed.max:false;
   need(same(sample.actual,actual)&&same(sample.expected,point.expectedRGBA)&&same(sample.tolerance,point.tolerance)
    &&same(sample.channels,point.channels)&&same(sample.differences,differences)&&same(sample.failedChannels,failed)
    &&sample.bleedFailure===bleed&&sample.coverageOnly===(point.coverageOnly===true)&&sample.pass===(!failed.length&&!bleed),'raw sample result');
  }
  need(Array.isArray(observation.representationFailures)&&observation.pass===(observation.samples.every(value=>value.pass)&&!observation.representationFailures.length),'observation result');
  if(assigned){const sample=observation.samples.find(value=>value.id===assigned[2]);need(observation.pass===false&&sample?.failedChannels.includes(assigned[3]),'assigned numeric channel');}
  else need(observation.pass===true&&empty(observation.representationFailures),'healthy baseline/restoration');
 }
 // The collector owns source-bound mutation and closure qualification. Require
 // the retained outcome and artifact identities, never infer them from PASS.
 for(const [index,row] of receipt.controls.entries()){
  const [id,,point,channel]=sharedControls[index],control=controls[index];
  const assigned=receipt.runs[30+3*index+1].observations[0].samples.find(value=>value.id===point);
  need(row.witness===point&&row.channel===channel&&same(row.observed,assigned.actual)&&row.baseline===true&&row.restored===true
   &&row.assignedFailure===true&&row.file===control.file&&row.from===control.from&&row.to===control.to
   &&pin(row.original)&&row.original.sha256!==row.changed?.sha256,'control evidence');
  artifact(row.changed,id+'-module.js');
 }
 return {status:receipt.status,browser:receipt.browser};
}

/** A zero exit is necessary, but never substitutes for a suite completion receipt. */
export function readCompletion(suite,output,stdout){
 const receipt=suite==='canvas'?JSON.parse(stdout):JSON.parse(fs.readFileSync(path.join(output,['resource-scene','bitmap-slot'].includes(suite)?'report.json':'result.json'),'utf8'));
 if(suite==='canvas'){
  if(!receipt.browser||receipt.playwright!==matrix.playwright||receipt.channel!==matrix.channel||receipt.headless!==true||receipt.pointerPixelsChanged!==true||!receipt.checks?.length||receipt.counterexample?.failed!==true||receipt.unexpectedErrors?.length!==0)throw Error('Incomplete Canvas receipt');
  for(const name of ['example-before.png','example-after.png','acceptance.png'])if(!fs.statSync(path.join(output,name)).isFile()||fs.statSync(path.join(output,name)).size===0)throw Error('Missing Canvas artifact');
 }else if(suite==='shared-webgpu'){
  return sharedCompletion(receipt,output);
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
