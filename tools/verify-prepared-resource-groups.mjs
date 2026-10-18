// SPDX-License-Identifier: Apache-2.0
// First-party finite native verifier. Independent input snapshot precedes browser execution.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireThat = (value, message) => { if (!value) throw new Error(message); };
const equal = (actual, expected, message) => requireThat(JSON.stringify(actual) === JSON.stringify(expected), message);
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const physical = process.platform === 'win32' ? path.win32 : path.posix;
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const argumentsMap = new Map(); let snapshotOnly = false;
for (let at = 2; at < process.argv.length; at++) {
  const key = process.argv[at];
  if (key === '--snapshot-only' && !snapshotOnly) { snapshotOnly = true; continue; }
  requireThat(['--config', '--config-sha256'].includes(key) && !argumentsMap.has(key) && process.argv[at + 1], 'Unique named arguments required');
  argumentsMap.set(key, process.argv[++at]);
}
requireThat(path.isAbsolute(argumentsMap.get('--config') ?? '') && /^[a-f0-9]{64}$/.test(argumentsMap.get('--config-sha256') ?? ''), 'Pinned absolute configuration required');
const configRaw = fs.readFileSync(argumentsMap.get('--config'));
requireThat(hash(configRaw) === argumentsMap.get('--config-sha256'), 'Configuration raw identity differs');
const config = JSON.parse(decode(configRaw));
requireThat(exactKeys(config, ['schemaVersion','repositoryRoot','taskRoot','fixture','supplementaryModules','expectedAbsentModules','snapshot','output','playwrightRoot','expectedPhase','caseContract','nativeScenario','oracle']), 'Configuration fields differ');
requireThat(config.schemaVersion === 1 && ['RED', 'GREEN'].includes(config.expectedPhase), 'Configuration revision/phase differs');
for (const name of ['repositoryRoot','taskRoot','snapshot','output','playwrightRoot']) requireThat(path.isAbsolute(config[name]), 'Absolute ' + name + ' required');
const repository = fs.realpathSync(config.repositoryRoot), taskRoot = fs.realpathSync(config.taskRoot);
const actualRoot=fs.realpathSync(fileURLToPath(new URL('..',import.meta.url)));
requireThat(physical.relative(actualRoot,repository)==='','Configuration must select this verifier repository');
requireThat(exactKeys(config.caseContract,['baselineNames','assignedNames','missingCode'])
  && Array.isArray(config.caseContract.baselineNames) && config.caseContract.baselineNames.length===1
  && Array.isArray(config.caseContract.assignedNames) && config.caseContract.assignedNames.length===1
  && config.caseContract.assignedNames.length<64,'Finite reviewed case contract required');
const expectedNames=[...config.caseContract.baselineNames,...config.caseContract.assignedNames];
requireThat(new Set(expectedNames).size===expectedNames.length&&expectedNames.every(name=>typeof name==='string'&&name.length>0&&name.length<160),'Unique finite case names required');
requireThat(config.expectedPhase==='RED'?config.caseContract.missingCode==='P03_MISSING_PREPARED_RESOURCE_APPLICATION':config.caseContract.missingCode===null,'Named missing-module contract differs');

requireThat(exactKeys(config.nativeScenario,['profile','kind'])
  && ['canvas-2d','webgpu-scene-textured'].includes(config.nativeScenario.profile)
  && ['ordinary','manual-old-A-outer','manual-old-B-trim'].includes(config.nativeScenario.kind),'Closed native scenario required');
const {profile,kind}=config.nativeScenario;
const fixedNames=['PSN00 genuine native scene prerequisite',kind==='ordinary'?'PSN01 ordinary application lifecycle':'PSN02 assigned wrong layer'];
equal(expectedNames,fixedNames,'Fixed native scene case names differ');
requireThat(config.expectedPhase!=='RED'||profile==='canvas-2d','Only Canvas missing-application RED is admitted');
const sequence=(kind==='ordinary'?[
  ['prerequisite-startup','classic-left-pose0'],['startup','classic-left-pose0'],['native-right','classic-right-pose0'],
  ['before-boundary','classic-right-before-boundary'],['boundary','classic-right-pose1'],['summer','summer-right-pose1'],
  ['classic-before-fault','classic-right-pose1'],['source-error','classic-right-pose1'],['source-undefined','classic-right-pose1'],
  ['held-cancel','classic-right-pose1'],['warm-cancel','classic-right-pose1'],['mix','mix-right-pose1'],
  ['classic-before-repeat','classic-right-pose1'],['repeated-summer','summer-right-pose1'],['repeated-mix','mix-right-pose1'],
  ['remove-left','removed-left-right-pose1'],['pending-close-before','removed-left-right-pose1'],
]:[['prerequisite-startup','classic-left-pose0'],['startup','classic-left-pose0'],['native-right','classic-right-pose0'],
  ['healthy-summer','summer-right-pose1'],['assigned-old-layer','summer-right-pose1']])
  .map(([label,frame])=>({label,frame,control:label==='assigned-old-layer'?kind:'ordinary'}));
const expectedSequence=config.expectedPhase==='RED'?sequence.slice(0,1):sequence;

// Authenticate the complete helper spelling and original bytes before importing it.
let helper = repository;
for (const [index, part] of 'tools/lib/file-identity.mjs'.split('/').entries()) {
  requireThat(fs.readdirSync(helper).includes(part), 'File-identity spelling differs');
  helper = physical.join(helper, part); const stat = fs.lstatSync(helper);
  requireThat(!stat.isSymbolicLink() && (index < 2 ? stat.isDirectory() : stat.isFile()), 'File-identity component differs');
}
const helperRaw = fs.readFileSync(helper), helperURL = pathToFileURL(helper);
requireThat(helperRaw.length === 5065 && hash(helperRaw) === '999b355c6e0d03f17853ee05f33abc9fecbb34ad80607963e11f913a4f815569', 'File-identity bootstrap raw bytes differ');
requireThat(physical.relative(repository, fs.realpathSync(helper)).split(physical.sep).join('/') === 'tools/lib/file-identity.mjs'
  && physical.relative(helper, fileURLToPath(helperURL)) === '', 'File-identity physical owner differs');
const identity = await import(helperURL.href);
requireThat(!identity.samePhysicalPath(repository,taskRoot),'External work directory required');
try{identity.ownerRelativePath(repository,taskRoot);throw new Error('Work directory belongs to repository');}
catch(cause){if(!(cause instanceof RangeError))throw cause;}
function read(owner, relative, pin) {
  const actual = identity.fingerprintFile(owner, relative);
  const raw = fs.readFileSync(path.join(owner, relative));
  equal({bytes:raw.length,sha256:hash(raw)}, {bytes:actual.bytes,sha256:actual.sha256}, 'Input changed while reading ' + relative);
  if (pin) equal({bytes:actual.bytes,sha256:actual.sha256}, {bytes:pin.bytes,sha256:pin.sha256}, 'Selected raw input differs ' + relative);
  return {raw,pin:actual};
}
function externalNew(target) {
  const selected = path.join(fs.realpathSync(path.dirname(target)), path.basename(target));
  identity.ownerRelativePath(taskRoot, selected);
  try { identity.ownerRelativePath(repository, selected); throw new Error('Destination belongs to repository'); }
  catch (cause) { if (cause.message === 'Destination belongs to repository') throw cause; }
  requireThat(!fs.existsSync(selected), 'Fresh private destination required'); return selected;
}
// Retain the original collector identity; M1.3 adds only the exact Host sharedB1 edge.
const historicalCollectorSource = {bytes:25753,sha256:'10c52ae5f7c33d1550c9231956297bb041c7a8cb67af8c19b0fdf41842bc4cd4'};
const m13CollectorSourceSuccessor = {"bytes":25784,"sha256":"bc0ce6ccb3ae4ceed8797a4350fa9a7c4303d5e1091b2d7847837d8073abec8b"};
const collector = read(repository, 'tools/resource-scene-boundary.mjs', m13CollectorSourceSuccessor);
const { collectResourceSceneSource } = await import(pathToFileURL(path.join(repository, 'tools/resource-scene-boundary.mjs')).href);
const collected = await collectResourceSceneSource({repository});
const routes = new Map([...collected.routes].filter(([url]) => ![
  '/examples/resource-scene/index.html','/examples/resource-scene/main.mjs','/examples/resource-scene/session.mjs',
].includes(url)));
const moduleNames = new Set(['coordinator.mjs','source.mjs','session.mjs','dependencies.mjs','main.mjs','application.mjs']);
const selectedModules = [], absent = [];
requireThat(Array.isArray(config.supplementaryModules) && config.supplementaryModules.length <= 6
  && Array.isArray(config.expectedAbsentModules) && config.expectedAbsentModules.length <= 2, 'Finite supplemental inventory required');
for (const item of config.supplementaryModules) {
  requireThat(exactKeys(item,['path','bytes','sha256','reviewedEdges']) && Array.isArray(item.reviewedEdges)
    && item.path === 'examples/prepared-resource-groups/' + path.posix.basename(item.path)
    && moduleNames.has(path.posix.basename(item.path)), 'Selected supplementary module differs');
  const input = read(repository,item.path,item), route = '/' + item.path;
  requireThat(!routes.has(route), 'Duplicate supplementary route');
  routes.set(route,{bytes:input.raw,contentType:'text/javascript; charset=utf-8'});
  selectedModules.push({...input.pin,reviewedEdges:item.reviewedEdges});
}
for (const relative of config.expectedAbsentModules) {
  identity.logicalPath(relative);
  requireThat(relative === 'examples/prepared-resource-groups/' + path.posix.basename(relative)
    && moduleNames.has(path.posix.basename(relative)) && !fs.existsSync(path.join(repository,relative))
    && !routes.has('/' + relative) && !absent.includes(relative), 'Declared absent module differs');
  absent.push(relative);
}
requireThat(config.expectedPhase === 'RED' ? absent.length === 1 : absent.length === 0, 'Phase and declared absence differ');
requireThat(exactKeys(config.fixture,['path','route','bytes','sha256','exportName','reviewedEdges'])
  && path.isAbsolute(config.fixture.path) && /^\/examples\/prepared-resource-groups\/__[a-z-]+\.mjs$/.test(config.fixture.route)
  && config.fixture.exportName==='runPreparedResourceSceneFixture'
  && Array.isArray(config.fixture.reviewedEdges), 'Finite fixture identity required');
if(config.expectedPhase==='RED')equal({path:absent[0],code:config.caseContract.missingCode},
  {path:'examples/prepared-resource-groups/application.mjs',code:'P03_MISSING_PREPARED_RESOURCE_APPLICATION'},'Application-only missing module contract differs');
requireThat(exactKeys(config.oracle,['path','bytes','sha256'])&&path.isAbsolute(config.oracle.path),'Exact independent oracle identity required');
const oracleRelative='tools/prepared-resource-groups/oracle.mjs';
requireThat(identity.ownerRelativePath(repository,config.oracle.path)===oracleRelative,'Only repository-owned independent oracle path admitted');
equal({bytes:config.oracle.bytes,sha256:config.oracle.sha256},
  {bytes:7944,sha256:'d213b1c082ccb3290866928c8180be6af43de11101e6213d367fd227c86d526c'},'Original independent oracle config pin differs');
const oracleInput=read(repository,oracleRelative,config.oracle);
// Raw authentication and strict identity precede any oracle evaluation.
const {comparePreparedFrame}=await import(pathToFileURL(path.join(repository,oracleRelative)).href);
requireThat(typeof comparePreparedFrame==='function','Independent oracle export missing');
const referenceManifest=read(repository,'tools/resource-scene/reference/manifest.json',
  {bytes:4364,sha256:'3fd92da19b29877da856e104d857b606305745baf280a9f3258d41a166247e8a'});
const referenceInputs={
  left:read(repository,'tools/resource-scene/reference/left.rgba',{bytes:12288,sha256:'f972dbeb2c4d4f314b4ab922a4ec9afd7569ec156eb90c4757cf3a728bcee394'}),
  right:read(repository,'tools/resource-scene/reference/right.rgba',{bytes:12288,sha256:'941dc2c181e97c65da54d60969c27b140a8431abd75c4da8a10ff08d3569092b'}),
};
const references={left:referenceInputs.left.raw,right:referenceInputs.right.raw};
const fixtureRelative='tools/prepared-resource-groups/native-fixture.mjs';
requireThat(identity.ownerRelativePath(repository,config.fixture.path)===fixtureRelative,'Only repository-owned native fixture path admitted');
equal({bytes:config.fixture.bytes,sha256:config.fixture.sha256},
  {bytes:20027,sha256:'0de059155c414c6f8e494c8501f6ff3b4e24d0581f9ec86e238e421738767b77'},'Original native fixture config pin differs');
const fixture=read(repository,fixtureRelative,config.fixture);
requireThat(!routes.has(config.fixture.route), 'Duplicate fixture route');
routes.set(config.fixture.route,{bytes:fixture.raw,contentType:'text/javascript; charset=utf-8'});
const htmlRoute='/examples/prepared-resource-groups/__native-fixture.html';
const html=Buffer.from('<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>Egret finite native fixture</title><script type="importmap">'
  + JSON.stringify(collected.snapshot.authoredImportMap) + '</script><body></body></html>');
routes.set(htmlRoute,{bytes:html,contentType:'text/html; charset=utf-8'});
const runnerRelative=identity.ownerRelativePath(repository,fs.realpathSync(fileURLToPath(import.meta.url)));
requireThat(runnerRelative==='tools/verify-prepared-resource-groups.mjs','Native verifier owner path differs');
const runner=read(repository,runnerRelative);
const playwrightRoot = fs.realpathSync(config.playwrightRoot), pwPackage = read(playwrightRoot,'package.json'), pwEntry = read(playwrightRoot,'index.mjs');
const pwMeta = JSON.parse(decode(pwPackage.raw));
requireThat(pwMeta.name === 'playwright' && pwMeta.version === '1.62.1', 'Original Playwright 1.62.1 required');
equal(pwMeta.dependencies,{'playwright-core':'1.62.1'},'Selected Playwright dependency declaration differs');
const corePackagePath=createRequire(pathToFileURL(path.join(playwrightRoot,'index.mjs'))).resolve('playwright-core/package.json');
const coreRoot=fs.realpathSync(path.dirname(corePackagePath)),corePackage=read(coreRoot,'package.json'),coreMeta=JSON.parse(decode(corePackage.raw));
requireThat(coreMeta.name==='playwright-core'&&coreMeta.version==='1.62.1','Original resolved Playwright core required');
requireThat(Object.keys(coreMeta.dependencies??{}).length===0,'Unselected Playwright core dependency');
function packageInventory(owner){
  const result=[];
  function walk(relative){
    for(const entry of fs.readdirSync(path.join(owner,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const key=relative?relative+'/'+entry.name:entry.name;
      requireThat(!entry.isSymbolicLink(),'Symbolic toolkit package member refused: '+key);
      if(entry.isDirectory())walk(key);else{requireThat(entry.isFile(),'Nonregular toolkit member refused: '+key);result.push(read(owner,key).pin);}
    }
  }
  walk('');return result;
}
// Whole package inventories include lib/server and bundled helpers, not just barrels.
const toolkitPackages=[{ownerRoot:playwrightRoot,name:'playwright',version:pwMeta.version,files:packageInventory(playwrightRoot)},
  {ownerRoot:coreRoot,name:'playwright-core',version:coreMeta.version,resolvedPackagePath:corePackagePath,files:packageInventory(coreRoot)}];
const snapshot={schemaVersion:1,kind:'PREPARED_RESOURCE_NATIVE_SCENE_INPUTS',repositoryRoot:repository,taskRoot,
  config:{path:argumentsMap.get('--config'),bytes:configRaw.length,sha256:hash(configRaw)},runner:runner.pin,helper:{path:'tools/lib/file-identity.mjs',bytes:helperRaw.length,sha256:hash(helperRaw)},
  collector:collector.pin,admittedSource:collected.snapshot,supplementaryModules:selectedModules,expectedAbsentModules:absent,
  fixture:{...fixture.pin,route:config.fixture.route,exportName:config.fixture.exportName,reviewedEdges:config.fixture.reviewedEdges},
  generatedHTML:{route:htmlRoute,bytes:html.length,sha256:hash(html),kind:'VERIFIER_GENERATED_IMPORT_MAP_ONLY_NO_APPLICATION_BOOT'},
  routes:[...routes].map(([url,value])=>({url,bytes:value.bytes.length,sha256:hash(value.bytes),contentType:value.contentType})).sort((a,b)=>a.url.localeCompare(b.url)),
  playwright:{ownerRoot:playwrightRoot,version:pwMeta.version,package:pwPackage.pin,entry:pwEntry.pin,toolkitPackages},expectedPhase:config.expectedPhase,caseContract:config.caseContract,
  nativeScenario:config.nativeScenario,sequence:expectedSequence,oracle:oracleInput.pin,referenceManifest:referenceManifest.pin,referenceRgba:Object.values(referenceInputs).map(value=>value.pin),
  sourceBoundary:'Supplementary edge inventories are separately source-reviewed; the retained P02 collector does not parse or admit new P03 modules.'};
if(snapshotOnly){const destination=externalNew(config.snapshot);fs.writeFileSync(destination,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});const raw=fs.readFileSync(destination);console.log(JSON.stringify({status:'SOURCE_SNAPSHOT_ONLY_NO_BROWSER',path:destination,bytes:raw.length,sha256:hash(raw)}));process.exit(0);}
const snapshotRelative=identity.ownerRelativePath(taskRoot,config.snapshot), approved=read(taskRoot,snapshotRelative);
equal(snapshot,JSON.parse(decode(approved.raw)), 'Complete reviewed source snapshot differs');
const output=externalNew(config.output);fs.mkdirSync(output);
const report={schemaVersion:1,status:'RUNNING',expectedPhase:config.expectedPhase,snapshot:{path:config.snapshot,bytes:approved.raw.length,sha256:hash(approved.raw)},
  environment:{node:process.version,platform:os.platform(),arch:os.arch(),release:os.release(),browserChannel:'msedge',extraLaunchFlags:[],playwrightVersion:pwMeta.version,locale:'zh-CN',viewport:{width:960,height:800},deviceScaleFactor:1},
  nativeScenario:config.nativeScenario,expectedFrameSequence:expectedSequence,rawFrames:[],savedVerifierRGBABytes:0,bridgeFailures:[],nativeClicks:[],nativeAcceptance:'OPEN',ordinaryAccepted:false,
  console:[],pageErrors:[],requests:[],http:[],fixtureResult:null,expectedRedMatched:false,failures:[],retirementFailures:[],retired:{server:false,context:false,browser:false},
  limits:['Finite fixture in the recorded desktop browser only; no phone/performance/physical GPU memory claim.','No remote CI, publication or Main delivery claim.','A named missing-module RED is prerequisite evidence only.']};
const reportPath=path.join(output,'report.json');
function save(){fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');}
function errorView(cause,seen=new Set(),depth=0){
  const value={wasUndefined:cause===undefined,name:typeof cause?.name==='string'?cause.name:null,code:typeof cause?.code==='string'?cause.code:null,message:String(cause?.message??cause)};
  if(cause!==null&&(typeof cause==='object'||typeof cause==='function')){
    if(seen.has(cause)){value.cycle=true;return value;}seen.add(cause);
    if(depth>=16){value.truncated=true;return value;}
    if(Object.hasOwn(cause,'details'))value.details=cause.details;
    if(Object.hasOwn(cause,'cause'))value.cause=errorView(cause.cause,new Set(seen),depth+1);
    if(Array.isArray(cause.cleanupErrors))value.cleanupErrors=cause.cleanupErrors.map(item=>errorView(item,new Set(seen),depth+1));
    if(Array.isArray(cause.errors))value.errors=cause.errors.map(item=>errorView(item,new Set(seen),depth+1));
  }
  return value;
}
const pending=new Set();
async function bounded(original,label,milliseconds=30000){const task=Promise.resolve(original);pending.add(task);void task.then(()=>pending.delete(task),()=>pending.delete(task));let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Deadline: '+label)),milliseconds);})]);}finally{clearTimeout(timer);}}
const owners=[];
async function acquire(name,create,close){const original=Promise.resolve().then(create);const owner={name,original,close,retirement:undefined};owners.push(owner);return bounded(original,'acquire '+name);}
let server,browser,context;
// JSON-only bridge domain: bounded depth, nodes, strings and exact byte array.
function finiteTransport(value){
  let nodes=0,characters=0;
  function visit(item,depth){
    requireThat(++nodes<=1200000&&depth<=32,'Bridge transport structure exceeds finite bound');
    if(item===null||typeof item==='boolean')return;
    if(typeof item==='number'){requireThat(Number.isFinite(item),'Nonfinite bridge number');return;}
    if(typeof item==='string'){characters+=item.length;requireThat(characters<=8*1024*1024,'Bridge text exceeds finite bound');return;}
    requireThat(typeof item==='object'&&(Array.isArray(item)||Object.getPrototypeOf(item)===Object.prototype),'Bridge transport must be plain JSON');
    if(Array.isArray(item)){requireThat(item.length<=8*1024*1024,'Bridge array exceeds finite bound');for(const part of item)visit(part,depth+1);}
    else{requireThat(Object.keys(item).length<=512,'Bridge record exceeds finite bound');for(const [key,part]of Object.entries(item)){characters+=key.length;visit(part,depth+1);}}
  }
  visit(value,0);requireThat(Buffer.byteLength(JSON.stringify(value))<=8*1024*1024,'Bridge complete transport exceeds 8MiB');
}
function verifyRetirement(value){
  requireThat(exactKeys(value,['session','source','dependencies','host','canvas','pendingPresentations','cleanupErrors','safeSurface',
    'readerPending','readerHeldBytes','warmLeases','warmPending','coordinators']),'Closed original retirement record required');
  requireThat(value.session?.state==='closed'&&value.session.pendingTasks===0,'Original session is not fully closed');
  equal(value.session.cleanupErrors,[],'Original session cleanup errors');equal(value.session.diagnostics,[],'Original session diagnostics');
  requireThat(value.source?.state==='closed'&&['activeJobs','pendingReads','encodedReservedBytes','rawOwnedBytes','decodedLiveBytes','liveValues']
    .every(key=>value.source[key]===0),'Original source reservations/payloads are not retired');
  requireThat(value.dependencies?.state==='closed'&&['initializationPending','activeTextureJobs','pendingImageReads','pendingFontReads','pendingFontLoads',
    'pendingFontSelections','imageEncodedReservedBytes','imageRawOwnedBytes','decodedLiveBytes','liveTextures','fontRawOwnedBytes',
    'fontPayloadBytes','installedFonts','cleanupFailures'].every(key=>value.dependencies[key]===0),'Original dependency work/payloads/fonts are not retired');
  equal(value.canvas,{connected:false,width:0,height:0},'Actual safe canvas retirement differs');
  requireThat(value.safeSurface===true&&value.pendingPresentations===0&&value.readerPending===0&&value.readerHeldBytes===0
    &&value.warmLeases===0&&value.warmPending===0,'Original presentation/reader/warm owners remain live');
  equal(value.cleanupErrors,[],'Original application/direct-host cleanup errors');
  requireThat(Array.isArray(value.coordinators)&&value.coordinators.length===2&&value.coordinators.every(row=>row?.state==='disposed'
    &&row.pendingKey===null&&row.sourcePending===0&&exactKeys(row.logical,['sets','encodedBytes','decodedBytes'])
    &&Object.values(row.logical).every(count=>count===0)),'Both original coordinators must be fully retired, including removed actor');
  if(profile==='canvas-2d')requireThat(value.host===null,'Canvas must not fabricate GPU status');
  else{
    requireThat(exactKeys(value.host,['general','textured','scene']),'Original GPU status triple required');
    const {general,textured,scene}=value.host;
    requireThat(general?.pendingFrames===0&&general.pendingUploadBytes===0&&general.pendingReadbackBytes===0
      &&general.firstFailure===null&&general.callbackFailureCount===0&&general.cleanupOutcome==='safe'
      &&textured?.pendingGeometryBytes===0&&scene?.pendingSceneBytes===0&&scene.pendingUniformBytes===0&&scene.pendingDepthBytes===0,
      'Original GPU work/diagnostics/safe cleanup incomplete');
  }
}
function verifyTrustedMouse(value){
  requireThat(exactKeys(value,['events','activations'])&&Array.isArray(value.events)&&value.events.length>=3&&value.events.length<=64
    &&Array.isArray(value.activations)&&value.activations.length===1,'Closed genuine native mouse evidence required');
  const click=report.nativeClicks[0];requireThat(click?.status==='NATIVE_ACTIONS_COMPLETE','Original native action record missing');
  const expectedButtons={mousemove:0,mousedown:1,mouseup:0};
  requireThat(value.events.every(row=>exactKeys(row,['type','isTrusted','clientX','clientY','button','buttons'])&&Object.hasOwn(expectedButtons,row.type)
    &&row.isTrusted===true&&row.clientX===click.before.x&&row.clientY===click.before.y&&row.button===0&&row.buttons===expectedButtons[row.type]),
    'Actual trusted native coordinates/buttons differ');
  const indices=['mousemove','mousedown','mouseup'].map(type=>value.events.findIndex(row=>row.type===type));
  requireThat(indices.every(at=>at>=0)&&indices[0]<indices[1]&&indices[1]<indices[2],'Actual native event order differs');
  equal(value.activations,[{type:'egret.mouse.activate',targetId:'pilot-right',x:136,y:72}],'Actual public SDK activation/target/payload differs');
}
const frameIds={prerequisite:new Set(),application:new Set()},serials={prerequisite:new Set(),application:new Set()};
let frameBridgeBusy=false,clickBridgeBusy=false;
function retainOriginalBridge(operation){
  const original=Promise.resolve().then(operation);pending.add(original);
  void original.then(()=>pending.delete(original),()=>pending.delete(original));return original;
}
try{
  server=createServer((request,response)=>{
    const url=new URL(request.url,'http://127.0.0.1'),entry=routes.get(url.pathname);
    const code=request.method==='GET'&&url.search===''&&entry?200:404;
    report.http.push({method:request.method,path:url.pathname,query:url.search,status:code,selected:!!entry});
    response.writeHead(code,{'content-type':code===200?entry.contentType:'text/plain; charset=utf-8','cache-control':'no-store'});
    response.end(code===200?entry.bytes:'Unselected finite route');
  });
  server=await acquire('server',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server));}),value=>new Promise((resolve,reject)=>value.close(error=>error?reject(error):resolve())));
  const origin='http://127.0.0.1:'+server.address().port;
  const {chromium}=await import(pathToFileURL(path.join(playwrightRoot,'index.mjs')).href);
  browser=await acquire('browser',()=>chromium.launch({channel:'msedge',headless:true}),value=>value.close());report.environment.browserVersion=browser.version();
  context=await acquire('context',()=>browser.newContext({viewport:report.environment.viewport,deviceScaleFactor:1,locale:'zh-CN'}),value=>value.close());
  const page=await bounded(context.newPage(),'page');
  page.on('console',message=>{if(['warning','error'].includes(message.type()))report.console.push({type:message.type(),text:message.text(),location:message.location()});});
  page.on('pageerror',error=>report.pageErrors.push(errorView(error)));
  page.on('request',request=>report.requests.push({url:request.url(),method:request.method(),resourceType:request.resourceType()}));
    await page.exposeBinding('__egretPreparedNativeFrame',(source,...args)=>retainOriginalBridge(async()=>{
    const artifact={submission:report.rawFrames.length+1,status:'RECEIVED'};
    report.rawFrames.push(artifact);save();
    let ownsBridge=false;
    try{
      requireThat(source.page===page&&source.frame===page.mainFrame(),'Only original disposable main frame may submit');
      requireThat(!frameBridgeBusy,'Concurrent raw-frame submission refused');frameBridgeBusy=true;ownsBridge=true;
      requireThat(args.length===1,'One finite frame record required');const payload=args[0];finiteTransport(payload);
      requireThat(exactKeys(payload,['label','frame','control','presentation','observations']),'Closed frame transport fields required');
      const {presentation}=payload;
      requireThat(payload.observations!==null&&typeof payload.observations==='object'&&!Array.isArray(payload.observations),'Finite observations record required');
      requireThat(presentation!==null&&typeof presentation==='object'&&!Array.isArray(presentation)
        &&Array.isArray(presentation.bytes)&&presentation.bytes.length<=8*1024*1024
        &&presentation.bytes.every(value=>Number.isInteger(value)&&value>=0&&value<=255),'Original finite integer byte transport required');
      const raw=Buffer.from(presentation.bytes),filename='frame-'+String(artifact.submission).padStart(3,'0')+'.rgba',disk=path.join(output,filename);
      fs.writeFileSync(disk,raw,{flag:'wx'});const savedRaw=fs.readFileSync(disk);
      artifact.raw={filename,bytes:raw.length,sha256:hash(raw),readbackBytes:savedRaw.length,readbackSha256:hash(savedRaw)};
      report.savedVerifierRGBABytes+=savedRaw.length;
      artifact.metadata=Object.fromEntries(Object.entries(presentation).filter(([key])=>key!=='bytes'));
      artifact.label=payload.label;artifact.frame=payload.frame;artifact.control=payload.control;artifact.observations=payload.observations;
      artifact.status='ORIGINAL_RAW_SAVED';save();
      equal({bytes:savedRaw.length,sha256:hash(savedRaw)},{bytes:raw.length,sha256:hash(raw)},'Original saved raw authentication failed');
      requireThat(raw.length===98304&&presentation.width===192&&presentation.height===128,'Exact192x128 original RGBA required');
      requireThat(exactKeys(presentation,['label','frameId','serial','width','height','bytes','frameImagesBytes','geometryLogicalBytes']),'Original presentation metadata fields differ');
      const expected=expectedSequence[artifact.submission-1];requireThat(expected,'Extra native submission refused');
      equal({label:payload.label,frame:payload.frame,control:payload.control},expected,'Fixed verifier frame sequence differs');
      requireThat(artifact.submission!==3||report.nativeClicks.length===1&&report.nativeClicks[0].status==='NATIVE_ACTIONS_COMPLETE','Native selection requires original mouse actions first');
      requireThat(presentation.label===(payload.label==='native-right'?'native-selection':payload.label),'Original presentation label differs');
      const epoch=artifact.submission===1?'prerequisite':'application';artifact.epoch=epoch;
      requireThat(Number.isSafeInteger(presentation.frameId)&&presentation.frameId>0&&!frameIds[epoch].has(presentation.frameId)
        &&[...frameIds[epoch]].every(value=>value<presentation.frameId),'Per-epoch original frameId must be fresh and increasing');
      requireThat(['frameImagesBytes','geometryLogicalBytes'].every(key=>Number.isSafeInteger(presentation[key])&&presentation[key]>=0),'Finite original payload accounts required');
      if(profile==='canvas-2d')requireThat(presentation.serial===null,'Canvas must retain original null serial');
      else{
        requireThat(Number.isSafeInteger(presentation.serial)&&presentation.serial>0&&!serials[epoch].has(presentation.serial)
          &&[...serials[epoch]].every(value=>value<presentation.serial),'Per-epoch GPU serial must be fresh and increasing');
        serials[epoch].add(presentation.serial);
      }
      frameIds[epoch].add(presentation.frameId);
      artifact.comparison=comparePreparedFrame({rgba:savedRaw,profile,frame:expected.frame,control:expected.control,references,environment:report.oracleEnvironment});
      artifact.status='COMPARISON_SAVED';save();
      return {accepted:true,submission:artifact.submission,label:expected.label,raw:artifact.raw,comparison:artifact.comparison.status,ordinaryAccepted:artifact.comparison.ordinaryAccepted};
    }catch(cause){artifact.status='FAILED';artifact.error=errorView(cause);report.bridgeFailures.push({bridge:'frame',submission:artifact.submission,error:errorView(cause)});save();throw cause;}
    finally{if(ownsBridge)frameBridgeBusy=false;}
  }));
  await page.exposeBinding('__egretPreparedNativeClick',(source,...args)=>retainOriginalBridge(async()=>{
    const record={status:'RECEIVED',logical:[136,72],actions:[]};report.nativeClicks.push(record);save();
    let ownsBridge=false;
    try{
      requireThat(source.page===page&&source.frame===page.mainFrame()&&args.length===0,'No-argument original main-frame click required');
      requireThat(!clickBridgeBusy&&report.nativeClicks.length===1&&report.rawFrames.length===2
        &&report.rawFrames.every(row=>row.status==='COMPARISON_SAVED'),'Exactly one native click follows both genuine initial acknowledgements');
      clickBridgeBusy=true;ownsBridge=true;
      const layout=()=>page.evaluate(()=>{
        const all=document.querySelectorAll('#scene'),canvas=all[0];
        if(all.length!==1||!(canvas instanceof HTMLCanvasElement))throw new Error('Exactly one real #scene canvas required');
        const style=getComputedStyle(canvas),rect=canvas.getBoundingClientRect(),x=rect.left+136,y=rect.top+72;
        const view={width:canvas.width,height:canvas.height,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom},
          transform:style.transform,border:[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth],
          padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft],display:style.display,visibility:style.visibility,opacity:style.opacity,
          viewport:{width:innerWidth,height:innerHeight},connected:canvas.isConnected,unobscured:document.elementFromPoint(x,y)===canvas,x,y};
        if(!view.connected||view.width!==192||view.height!==128||rect.width!==192||rect.height!==128||style.transform!=='none'
          ||view.border.some(value=>value!=='0px')||view.padding.some(value=>value!=='0px')||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)!==1
          ||rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight||!view.unobscured)throw new Error('Native canvas layout guard failed');
        return view;
      });
      record.before=await bounded(layout(),'native click layout before');
      record.stable=await bounded(layout(),'native click stable layout');equal(record.stable,record.before,'Native layout moved before mouse');save();
      await bounded(page.mouse.move(record.before.x,record.before.y),'original native mouse move');record.actions.push({type:'move',x:record.before.x,y:record.before.y});save();
      equal(await bounded(layout(),'native click moved layout'),record.before,'Native layout moved after mouse move');
      await bounded(page.mouse.down({button:'left'}),'original native mouse down');record.actions.push({type:'down',button:'left'});save();
      await bounded(page.mouse.up({button:'left'}),'original native mouse up');record.actions.push({type:'up',button:'left'});save();
      record.after=await bounded(layout(),'native click layout after');equal(record.after,record.before,'Native layout moved during click');
      record.status='NATIVE_ACTIONS_COMPLETE';save();return {performed:true,logical:[136,72]};
    }catch(cause){record.status='FAILED';record.error=errorView(cause);report.bridgeFailures.push({bridge:'click',error:errorView(cause)});save();throw cause;}
    finally{if(ownsBridge)clickBridgeBusy=false;}
  }));
  await bounded(page.goto(origin+htmlRoute,{waitUntil:'load'}),'fixture page');
  const observed=await bounded(page.evaluate(()=>({browserLanguage:navigator.language,userAgent:navigator.userAgent})),'actual browser language');
  report.environment.browserLanguage=observed.browserLanguage;report.environment.userAgent=observed.userAgent;
  report.oracleEnvironment={browser:'Microsoft Edge',browserVersion:report.environment.browserVersion,playwrightVersion:pwMeta.version,
    platform:os.platform(),arch:os.arch(),release:os.release(),browserLanguage:observed.browserLanguage,extraLaunchFlags:[]};save();
  report.fixtureResult=await bounded(page.evaluate(async({route,exportName,nativeScenario})=>{const fixture=await import(route);if(typeof fixture[exportName]!=='function')throw new Error('Fixed fixture export missing');return fixture[exportName](nativeScenario);},{route:config.fixture.route,exportName:config.fixture.exportName,nativeScenario:config.nativeScenario}), 'original fixture result',90000);
  const cases=report.fixtureResult?.cases;
  requireThat(Array.isArray(cases)&&cases.length>0&&cases.length<=64&&cases.every(row=>typeof row?.name==='string'&&typeof row.ok==='boolean'&&typeof row.phase==='string'),'Finite original fixture cases required');
  equal(cases.map(row=>row.name),expectedNames,'Exact reviewed case names/order differ');
  requireThat(cases[0].ok&&cases[0].phase==='baseline','Genuine independent baseline did not pass');
    const assigned=cases.slice(1);
  verifyRetirement(cases[0].observations?.retirement);
  if(config.expectedPhase==='GREEN'){
    verifyRetirement(assigned[0].observations?.retirement);
    verifyTrustedMouse(assigned[0].observations?.trustedMouse);
  }
  requireThat(report.bridgeFailures.length===0,'Native bridge failure retained');
  requireThat(report.rawFrames.length===expectedSequence.length&&report.rawFrames.every(row=>row.status==='COMPARISON_SAVED'),'Complete original native readback sequence required');
  requireThat(report.nativeClicks.length===(config.expectedPhase==='RED'?0:1)
    &&report.nativeClicks.every(row=>row.status==='NATIVE_ACTIONS_COMPLETE'&&row.actions.length===3),'Complete original native mouse evidence required');
  requireThat(report.http.some(row=>row.method==='GET'&&row.path==='/examples/prepared-resource-groups/application.mjs'
    &&row.query===''&&row.status===(config.expectedPhase==='RED'?404:200)),'Original application fetch required');
  requireThat(assigned.every(row=>row.phase==='assigned'),'Assigned case failed before its genuine prerequisite baseline');
  requireThat(report.pageErrors.length===0,'Unexpected page errors');
  requireThat(report.requests.every(row=>row.url.startsWith(origin+'/')),'Unexpected external browser request');
  const unexpectedHTTP=report.http.filter(row=>row.status!==200&&!(config.expectedPhase==='RED'&&row.status===404&&row.method==='GET'&&row.query===''&&absent.includes(row.path.slice(1))));
  requireThat(unexpectedHTTP.length===0,'Unexpected refused HTTP route');
  const advisory="Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently";
  for(const row of report.console){
    const url=row.location?.url;
    row.classification=row.type==='warning'&&row.text===advisory?'retained-readback-advisory':
      config.expectedPhase==='RED'&&row.type==='error'&&row.text==='Failed to load resource: the server responded with a status of 404 (Not Found)'
      &&typeof url==='string'&&url.startsWith(origin+'/')&&absent.includes(new URL(url).pathname.slice(1))?'assigned-absent-module-404':'unexpected';
  }
  requireThat(report.console.every(row=>row.classification!=='unexpected'),'Unexpected original console warning/error');
  if(config.expectedPhase==='RED'){
    const missingCode=config.caseContract.missingCode;
    requireThat(assigned.every(row=>!row.ok&&row.error?.code===missingCode&&row.error?.message===missingCode&&row.observations?.moduleStatus===404),'Exact named missing-module RED was not observed for every assigned case');
    const refused=report.http.filter(row=>row.status===404&&row.path==='/'+absent[0]&&row.method==='GET'&&row.query==='');
    requireThat(refused.length===assigned.length,'Each assigned missing-module occurrence requires an actual exact-route 404');
    report.expectedRedMatched=true;report.failures.push({kind:'assigned-named-missing',code:missingCode,path:absent[0],names:assigned.map(row=>row.name),originalHTTP404Count:refused.length});
  }else if(cases.some(row=>!row.ok))report.failures.push({kind:'fixture-cases',names:cases.filter(row=>!row.ok).map(row=>row.name)});
}catch(cause){report.failures.push({kind:'collector',error:errorView(cause)});}
finally{
  // Original acquisitions keep their retirement continuation even after a deadline.
  for(const owner of [...owners].reverse()){
    owner.retirement??=owner.original.then(value=>owner.close(value),()=>undefined);
    try{await bounded(owner.retirement,'retire '+owner.name);report.retired[owner.name]=true;}catch(cause){report.retirementFailures.push({name:owner.name,error:errorView(cause)});}
  }
  report.acquiredOwners=owners.map(owner=>owner.name);
  report.pendingOriginalTasks=pending.size;
  const cleanRetirement=report.retirementFailures.length===0&&pending.size===0;
  report.nativeAcceptance=report.failures.length===0&&cleanRetirement&&config.expectedPhase==='GREEN'?(kind==='ordinary'?'FINITE_NATIVE_SEQUENCE_PASS':'FINITE_NATIVE_CONTROL_DETECTED'):'OPEN';
  report.ordinaryAccepted=report.nativeAcceptance==='FINITE_NATIVE_SEQUENCE_PASS';
  report.status=config.expectedPhase==='RED'&&report.expectedRedMatched&&report.failures.length===1&&cleanRetirement?'EXPECTED_RED':
    config.expectedPhase==='GREEN'&&report.failures.length===0&&cleanRetirement?'PASS':'FAIL';save();
}
const saved=fs.readFileSync(reportPath);console.log(JSON.stringify({status:report.status,path:reportPath,bytes:saved.length,sha256:hash(saved),cases:report.fixtureResult?.cases?.length??null,pass:report.fixtureResult?.cases?.filter(row=>row.ok).length??null,failures:report.failures.length,retirementFailures:report.retirementFailures.length,pendingOriginalTasks:report.pendingOriginalTasks}));
if(report.status!=='PASS')process.exitCode=1;
