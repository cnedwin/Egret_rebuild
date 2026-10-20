// SPDX-License-Identifier: Apache-2.0
// Fixed current browser entry; absent capabilities and child failures never pass.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {fingerprintFile,samePhysicalPath,ownerRelativePath,canonicalTextBytes} from './lib/file-identity.mjs';
import assert from 'node:assert/strict';
import {validateRecoveryAccounting} from './shared-rendering/resource-recovery-collector.mjs';
import {compareRecoveryPixels,screenshotRGBA} from './shared-rendering/resource-recovery-oracle.mjs';
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

/** The longer foreground run is the sole exception to the existing timeout. */
export function browserTimeoutForSuite(suite){
 if(!matrix.current.some(row=>row.id===suite))throw Error('Unknown current browser suite');
 return suite==='resource-recovery'?4920000:300000;
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

const recoveryCases=[{id:'C01-gl-primary',backend:'gl',mode:'sustained'},{id:'C02-gpu-primary',backend:'gpu',mode:'sustained'},
 {id:'C03-gpu-borrowed',backend:'gpu',mode:'borrowed-retained'},{id:'C04-gl-loss-close',backend:'gl',mode:'loss-close'},
 {id:'C05-gl-restore-close',backend:'gl',mode:'restore-close'},{id:'C06-gpu-loss-close',backend:'gpu',mode:'loss-close'},
 {id:'C07-gpu-acquire-close',backend:'gpu',mode:'restore-close'}];
const recoveryCycleModes=['replace','cancel-before-fetch','cancel-native-decode','cancel-native-upload','binding-conflict'];
function recoveryObservations(def){
 const rows=[];let variant='a',atlas=0,interaction=false,input=0;
 const add=(channel,label,kind='scene',pageIds=[])=>rows.push({channel,label,kind,state:{variant,atlas,interaction},pageIds});
 const click=()=>{atlas=1-atlas;interaction=!interaction;add('readback','input-'+input++);};
 const pages=(start,count)=>Array.from({length:count},(_,index)=>'e_p'+String(start+index).padStart(2,'0'));
 add('readback','startup-first');click();
 if(def.mode==='sustained'){
  for(const [pass,start,count]of[['first',0,16],['second',16,16],['third',32,8]])add('readback','pressure-'+pass,'pressure',pages(start,count));
  add('presentation','pressure-cancel-preserves-third','pressure',pages(32,8));add('readback','pressure-revisit','pressure',pages(0,16));add('readback','pressure-return-to-scene');
  for(let slot=0;slot<120;slot++){
   if(slot<110){const round=Math.floor(slot/11),within=slot%11;
    if(within===10)add('readback','loss-'+round+(round%2?'-reload':'-retained'));
    else{const index=round*10+within,mode=recoveryCycleModes[index%5];add('readback','cycle-'+index+'-old');
     if(mode==='replace'){add('presentation','cycle-'+index+'-new-before-commit');variant=variant==='a'?'b':'a';add('readback','cycle-'+index+'-new');}
     else{add('presentation','cycle-'+index+'-refused-presentation');add('readback','cycle-'+index+'-old-preserved');}}
   }click();
  }
 }else if(def.mode==='borrowed-retained')add('readback','loss-0-retained');
 return rows;
}
function resourceRecoveryCompletion(output){
 const need=(value,label)=>{if(!value)throw Error('Incomplete resource recovery receipt: '+label);};
 const empty=value=>Array.isArray(value)&&value.length===0;
 const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 const namePattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
 const read=name=>{need(namePattern.test(name),'artifact name');const stat=fs.lstatSync(path.join(output,name));need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=16777216,'artifact extent');fingerprintFile(output,name);return fs.readFileSync(path.join(output,name));};
 const receipt=JSON.parse(read('report.json')),index=JSON.parse(read('artifacts.json'));
 need(receipt.schemaVersion===2&&receipt.status==='COMPLETE'&&receipt.acceptanceStatus==='COMPLETE'&&receipt.observedStatus==='COMPLETE','status');
 need(receipt.node==='v'+matrix.node&&typeof receipt.browser==='string'&&receipt.browser.length>0,'environment');
 assert.deepEqual(receipt.launch,{channel:matrix.channel,headless:false,additionalFlags:[],viewport:{width:256,height:256},deviceScaleFactor:1});
 assert.deepEqual(receipt.cases,recoveryCases);need(Array.isArray(receipt.runs)&&receipt.runs.length===7,'seven runs');assert.deepEqual(receipt.runs.map(row=>row.id),recoveryCases.map(row=>row.id));
 need(empty(receipt.errors)&&empty(receipt.cleanupFailures)&&receipt.browserClosed===true&&receipt.serverClosed===true&&receipt.inputsStable===true&&!receipt.eventOverflow,'outer cleanup');
 need(Array.isArray(receipt.requests)&&receipt.requests.length>0&&receipt.requests.every(row=>row.status===200),'server receipts');need(Number.isSafeInteger(receipt.allJsGzipBytes)&&receipt.allJsGzipBytes>0&&receipt.allJsGzipBytes<=1048576,'gzip budget');
 need(Array.isArray(receipt.coverageGaps)&&receipt.coverageGaps.length===2,'two gaps');assert.deepEqual(receipt.coverageGaps.map(row=>row.id),['C-SOURCE-RETAINED-PEAK','C-PRIVATE-RESIDENCY-PEAK']);
 for(const gap of receipt.coverageGaps){need(gap.status==='CLOSED','open diagnostic gap');assert.deepEqual(gap.evidence,receipt.runs.map(run=>({caseId:run.id,native:run.native,accountingStatus:'COMPLETE'})));}
 need(index.schemaVersion===1&&Array.isArray(index.artifacts)&&index.artifacts.length>0&&index.artifacts.length<=2048,'artifact index');
 const inventory=new Map();let bytes=0;for(const pin of index.artifacts){need(namePattern.test(pin.name)&&pin.name!=='artifacts.json'&&!inventory.has(pin.name),'unique artifact name');need(Number.isSafeInteger(pin.bytes)&&pin.bytes>0&&pin.bytes<=16777216&&/^[a-f0-9]{64}$/.test(pin.sha256),'artifact pin');bytes+=pin.bytes;inventory.set(pin.name,pin);}need(bytes<=536870912,'artifact total');
 assert.deepEqual(fs.readdirSync(output).sort(),[...inventory.keys(),'artifacts.json'].sort());
 const verified=new Map();function artifact(pin,name){need(pin?.name===name,'named artifact');assert.deepEqual(pin,inventory.get(name));if(!verified.has(name)){const body=read(name),actual=fingerprintFile(output,name);need(actual.bytes===pin.bytes&&actual.sha256===pin.sha256,'changed artifact '+name);verified.set(name,true);return body;}return fs.readFileSync(path.join(output,name));}
 artifact(inventory.get('report.json'),'report.json');artifact(receipt.inputs,'input-closure.json');const catalog=JSON.parse(artifact(receipt.catalog,'fixed-catalog.json'));
 assert.deepEqual([catalog.schemaVersion,catalog.width,catalog.height,catalog.profile],[1,256,256,'egret.shared-frame2d/1']);assert.deepEqual(catalog.cycleOrder,recoveryCycleModes);
 assert.deepEqual(catalog.policy,{cycles:100,losses:10,foregroundMs:1800000,slotMs:15000,slots:120,networkMbps:10,latencyMs:80,coldTargetMs:5000,retainedTargetMs:2000,reloadTargetMs:5000,maxJsGzipBytes:1048576,maxInitialAssetBytes:4194304,maxDecodedCpuBytes:134217728,maxReadyBytes:33554432,maxReadyEntries:256,maxReusableBytes:33554432,maxInFlightUploadBytes:67108864,maxTemporaryBytes:33554432});
 assert.deepEqual(catalog.variants,{a:['e_a0','e_a1'],b:['e_b0','e_b1']});assert.deepEqual(catalog.pressure,Array.from({length:40},(_,i)=>({id:'e_p'+String(i).padStart(2,'0'),rgba:[i*5+20,240-i*4,80,255]})));
 assert.deepEqual(catalog.references?.base,[{id:'resource-0',x:24,y:24,key:'resource0'},{id:'resource-1',x:72,y:24,key:'resource1'},
  {id:'mesh',x:136,y:24,rgba:[0,255,255,255]},{id:'atlas',x:200,y:24,key:'atlas'},{id:'clip-inside',x:24,y:88,rgba:[0,0,255,255]},
  {id:'clip-outside',x:64,y:88,rgba:[0,0,0,255]},{id:'transparent-order',x:120,y:88,rgba:[188,0,188,255],tolerance:1},
  {id:'b1',x:136,y:152,rgba:[255,0,255,255]},{id:'text-block',x:18,y:212,rgba:[255,255,255,255]},{id:'text-space',x:38,y:212,rgba:[0,0,0,255]},
  {id:'interaction',x:208,y:216,key:'interaction'},{id:'clear',x:248,y:248,rgba:[0,0,0,255]}]);
 need(Array.isArray(catalog.slots)&&catalog.slots.length===120,'slot count');for(let i=0;i<120;i++){const within=i%11,round=Math.floor(i/11),expected=i>=110?{index:i,atMs:i*15000,kind:'interaction'}:within===10?{index:i,atMs:i*15000,kind:'loss',lossIndex:round,reload:round%2===1}:{index:i,atMs:i*15000,kind:'cycle',cycleIndex:round*10+within,mode:recoveryCycleModes[(round*10+within)%5]};assert.deepEqual(catalog.slots[i],expected);}
 for(const [i,run]of receipt.runs.entries()){
  const def=recoveryCases[i];need(run.status==='COMPLETE'&&run.nativeStatus==='COMPLETE'&&run.contextClosed===true&&!run.failure&&!run.overflow&&empty(run.pageErrors)&&empty(run.cleanup)&&run.pendingNativeRequestsAtRealmDisposal===0,'run cleanup');need(Array.isArray(run.console)&&!run.console.some(row=>row.type==='error'),'console errors');
  assert.deepEqual(run.networkConditions,{method:'Network.emulateNetworkConditions',latency:80,downloadBytesPerSecond:1250000,uploadBytesPerSecond:1250000,cacheDisabled:true,clearBrowserCache:true,serviceWorkers:'block',bypassServiceWorker:true});
  const native=JSON.parse(artifact(run.native,def.id+'-native.json'));assert.deepEqual(validateRecoveryAccounting(native,def),run.accounting);
  const cleanup=native.cleanup;need(empty(cleanup.errors)&&empty(cleanup.pending)&&cleanup.providerPending===0&&cleanup.liveProviderValues===0&&cleanup.disposalExactlyOnce===true&&cleanup.nativeObserverValid===true&&cleanup.finalDiagnosticsValid===true,'original owners');
  need(cleanup.finalHost?.state==='closed'&&cleanup.finalHost.cleanupOutcome==='safe'&&cleanup.finalSession?.state==='closed','Host close');need(cleanup.png?.pending===0&&cleanup.png.issued>0&&!cleanup.png.overflow&&!cleanup.png.untracked&&empty(cleanup.png.failures),'PNG settlement');need(cleanup.pressure?.restored===true&&!cleanup.pressure.active&&!cleanup.pressure.overflow&&empty(cleanup.pressure.failures),'pressure observer restoration');
  if(def.backend==='gpu'&&def.mode!=='borrowed-retained'){const a=cleanup.acquisitions;need(a?.restored===true&&a.pendingRequests===0&&a.pendingLost===0&&!a.overflow&&!a.untracked&&empty(a.failures),'actual acquisition drain');if(def.mode==='sustained')need(a.requests?.length===11&&a.devices?.length===11&&new Set(a.devices.map(row=>row.id)).size===11,'eleven actual generations');}
  need(Array.isArray(native.checks)&&native.checks.length>0&&native.checks.every(row=>row.pass===true)&&!native.failure&&!native.accountingFailure&&!native.sampleFailure,'native checks');need(Array.isArray(native.visibility)&&native.visibility.length>0&&native.visibility.every(row=>row.state==='visible'&&row.focused===true),'foreground');
  need(finite(native.startup?.interactionMatchedAt)&&native.startup.interactionMatchedAt<=5000&&finite(native.startup.firstFrameAt)&&native.startup.firstFrameAt<=native.startup.interactionMatchedAt,'cold timing');
  need(native.interactions?.length===(def.mode==='sustained'?121:1)&&native.interactions.every(row=>row.trusted===true&&finite(row.dispatchedAt)&&finite(row.matchedAt)&&row.matchedAt>=row.dispatchedAt),'trusted inputs');
  if(def.mode==='sustained'){
   need(native.cycles?.length===100&&native.losses?.length===10&&native.foreground?.requiredMs===1800000&&finite(native.foreground.startedAt)&&finite(native.foreground.finishedAt)&&native.foreground.finishedAt-native.foreground.startedAt>=1800000,'primary schedule');
   for(const [n,row]of native.cycles.entries()){need(row.index===n&&row.mode===recoveryCycleModes[n%5]&&finite(row.startedAt)&&finite(row.finishedAt)&&row.finishedAt>=row.startedAt,'cycle schedule');if(row.mode==='replace'){const p=row.publication;need(finite(p?.readyAt)&&p.readyAt<=p.commitStartedAt&&p.commitStartedAt<=p.submittedAt&&p.submittedAt<=p.completedAt&&p.completedAt<=p.matchedAt,'publication phase order');}else need(typeof row.refusal?.message==='string','assigned refusal');}
  }else need(native.cycles?.length===0&&native.losses?.length===1,'separate case schedule');
  for(const [n,row]of native.losses.entries()){need(row.index===n&&row.reload===(def.mode==='sustained'&&n%2===1)&&finite(row.lostAt)&&row.lostAt>=row.requestedAt,'native loss');if(def.mode==='sustained'||def.mode==='borrowed-retained'){need(row.targetMs===(row.reload?5000:2000)&&finite(row.elapsedMs)&&row.elapsedMs<=row.targetMs&&row.elapsedMs===row.matchedAt-row.lostAt&&row.readyAt<=row.matchedAt,'recovery timing');}else need(finite(row.closedAt)&&row.closedAt>=row.lostAt,'loss/restore close');}
  const expected=recoveryObservations(def);for(const [channel,key]of[['readback','observations'],['presentation','presentations']]){
   const selected=expected.filter(row=>row.channel===channel);need(run[key]?.length===selected.length,'complete '+channel+' schedule');
   for(const [n,row]of run[key].entries()){
    assert.deepEqual({channel,label:row.label,kind:row.kind,state:row.state,pageIds:row.pageIds},selected[n]);const raw=artifact(row.raw,def.id+'-'+row.label+(channel==='readback'?'.rgba':'.png'));const pixels=channel==='readback'?raw:screenshotRGBA(raw);
    if(channel==='readback'){need(raw.length===262144,'RGBA extent');const rb=row.metadata;need(rb?.width===256&&rb.height===256&&rb.format==='rgba8unorm'&&rb.colorSpace==='srgb'&&rb.alphaMode==='opaque'&&['rgba8unorm','bgra8unorm'].includes(rb.sourceFormat),'readback shape');for(const key of ['frameId','serial','generation'])need(Number.isSafeInteger(rb[key])&&rb[key]>0,'readback identity');}
    const compared=compareRecoveryPixels(catalog,row,pixels);need(compared.pass===true,'reference pixels');assert.deepEqual({samples:row.samples,invalidAlpha:row.invalidAlpha,pass:row.pass},compared);
   }
  }
  need(run.checkpoints?.length===(def.mode==='sustained'?111:def.mode==='borrowed-retained'?2:1),'network checkpoints');assert.deepEqual(run.checkpoints.map(row=>row.kind),['startup',...(def.mode==='sustained'?catalog.slots.filter(row=>row.kind!=='interaction').map(row=>row.kind):def.mode==='borrowed-retained'?['loss']:[])]);need(run.checkpoints.every(row=>row.caseId===def.id&&row.network?.status==='COMPLETE'),'network checkpoint success');need(run.checkpoints[0].network.initialAssetBytes<=4194304,'initial assets');
  const network=JSON.parse(artifact(inventory.get(def.id+'-network.json'),def.id+'-network.json'));assert.deepEqual(network,run.network);need(network.length>0&&network.filter(row=>row.phase==='response').every(row=>!row.fromDiskCache&&!row.fromServiceWorker),'uncached network');
  const bootstrap=JSON.parse(artifact(inventory.get(def.id+'-bootstrap.json'),def.id+'-bootstrap.json'));need(bootstrap.allJsGzipBytes===receipt.allJsGzipBytes&&Number.isSafeInteger(bootstrap.inlineJsGzipBytes)&&bootstrap.inlineJsGzipBytes>0&&bootstrap.allJsGzipBytes+bootstrap.inlineJsGzipBytes<=1048576,'bootstrap gzip');
 }
 for(const [name,pin]of inventory)artifact(pin,name);
 return {status:'COMPLETE',browser:receipt.browser};
}

/** A zero exit is necessary, but never substitutes for a suite completion receipt. */
export function readCompletion(suite,output,stdout){
 if(suite==='resource-recovery')return resourceRecoveryCompletion(output);
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
 const result=spawnSync(process.execPath,childArgs,{cwd:root,windowsHide:true,encoding:'utf8',timeout:browserTimeoutForSuite(options.suite),maxBuffer:64*1024*1024});
 fs.writeFileSync(path.join(output,'stdout.log'),result.stdout??'');fs.writeFileSync(path.join(output,'stderr.log'),result.stderr??'');
 const stable=(!snapshotPin||JSON.stringify(fingerprintFile(path.dirname(options.snapshot),path.basename(options.snapshot)))===JSON.stringify(snapshotPin))&&pins.every(pin=>JSON.stringify(fingerprintFile(root,pin.path))===JSON.stringify(pin))&&JSON.stringify(fingerprintFile(installed,'package.json'))===JSON.stringify(packagePin)&&JSON.stringify(fingerprintFile(core,'package.json'))===JSON.stringify(corePin);
 let completion=null,completionError=null;try{completion=readCompletion(options.suite,childOutput,result.stdout??'');}catch(error){completionError=error.message;}
 const report={snapshot:snapshotPin,completion,completionError,schemaVersion:1,suite:options.suite,node:process.version,playwright:matrix.playwright,channel:matrix.channel,started,finished:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.message??null,inputs:pins,stable,status:!result.error&&result.status===0&&stable&&completion?'PASS':'INCOMPLETE',limits:['Only the selected suite and its recorded domain.','No phone, performance, complete engine or independent OS process-retirement acceptance.','Advanced and historical collectors retain separate obligations.']};
 fs.writeFileSync(path.join(output,'result.json'),canonicalTextBytes(JSON.stringify(report,null,2)));
 console.log(JSON.stringify(report));if(report.status!=='PASS')throw Error('Browser suite did not pass; inspect retained stdout/stderr and child artifacts');return report;
}
if(process.argv[1]&&samePhysicalPath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url)))runBrowser(process.argv.slice(2));
